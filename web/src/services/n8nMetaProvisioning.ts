// N8N credentials and provisioning not available in current API

interface N8nCredentials {
  n8n_url: string;
  api_key: string;
}

interface ProvisionParams {
  orgId: string;
  orgName: string;
  campaignName: string;
  integrationId: string;
  metaFormId: string;
  metaAccessToken: string;
  fieldMapping: Record<string, string>;
}

interface ProvisionResult {
  workflowId: string;
  folderId: string;
  credentialId: string;
}

async function getN8nCredentials(_orgId: string): Promise<N8nCredentials> {
  throw new Error("N8N credentials not available in current API");
}

function n8nFetch(baseUrl: string, apiKey: string, path: string, options: RequestInit = {}) {
  return fetch(`${baseUrl.replace(/\/$/, "")}/api/v1${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": apiKey,
      ...(options.headers || {}),
    },
  });
}

async function ensureFolder(baseUrl: string, apiKey: string, orgName: string, campaignName: string): Promise<string> {
  // List existing folders to find or create Clientes/<orgName>
  const listRes = await n8nFetch(baseUrl, apiKey, "/folders");
  const listData = await listRes.json();
  const folders: Array<{ id: string; name: string; parentId?: string }> = listData.data || [];

  // Find or create root "Clientes" folder
  let clientesFolder = folders.find((f) => f.name === "Clientes" && !f.parentId);
  if (!clientesFolder) {
    const res = await n8nFetch(baseUrl, apiKey, "/folders", {
      method: "POST",
      body: JSON.stringify({ name: "Clientes" }),
    });
    clientesFolder = await res.json();
  }

  // Find or create "<orgName>" folder inside Clientes
  let orgFolder = folders.find((f) => f.name === orgName && f.parentId === clientesFolder!.id);
  if (!orgFolder) {
    const res = await n8nFetch(baseUrl, apiKey, "/folders", {
      method: "POST",
      body: JSON.stringify({ name: orgName, parentId: clientesFolder!.id }),
    });
    orgFolder = await res.json();
  }

  // Create campaign folder inside org folder (always new, one per integration)
  const res = await n8nFetch(baseUrl, apiKey, "/folders", {
    method: "POST",
    body: JSON.stringify({ name: campaignName, parentId: orgFolder!.id }),
  });
  const campaignFolder = await res.json();
  return campaignFolder.id as string;
}

async function createMetaCredential(
  baseUrl: string,
  apiKey: string,
  accessToken: string,
  credentialName: string
): Promise<string> {
  const res = await n8nFetch(baseUrl, apiKey, "/credentials", {
    method: "POST",
    body: JSON.stringify({
      name: credentialName,
      type: "facebookLeadAdsOAuth2Api",
      data: { accessToken },
    }),
  });
  const data = await res.json();
  return data.id as string;
}

function buildWorkflowTemplate(params: {
  campaignName: string;
  integrationId: string;
  metaFormId: string;
  credentialId: string;
  folderId: string;
  ingestUrl: string;
  ingestSecret: string;
  fieldMapping: Record<string, string>;
}) {
  const fieldMappingCode = Object.entries(params.fieldMapping)
    .map(([metaField, crmField]) => `  mappedData["${crmField}"] = leadData["${metaField}"] ?? "";`)
    .join("\n");

  return {
    name: params.campaignName,
    folderId: params.folderId,
    nodes: [
      {
        id: "trigger",
        name: "Meta Lead Ads Trigger",
        type: "n8n-nodes-base.facebookLeadAdsTrigger",
        typeVersion: 1,
        position: [0, 0],
        credentials: { facebookLeadAdsOAuth2Api: { id: params.credentialId, name: "Meta" } },
        parameters: { formId: params.metaFormId },
      },
      {
        id: "transform",
        name: "Map Fields",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [250, 0],
        parameters: {
          jsCode: `
const leadData = $input.first().json;
const mappedData = {};
${fieldMappingCode}
return [{ json: {
  integration_id: "${params.integrationId}",
  lead_data: { ...leadData, ...mappedData }
}}];
          `.trim(),
        },
      },
      {
        id: "ingest",
        name: "Send to CRM",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4,
        position: [500, 0],
        parameters: {
          method: "POST",
          url: params.ingestUrl,
          sendHeaders: true,
          headerParameters: {
            parameters: [{ name: "x-n8n-signature", value: `={{$env.N8N_INGEST_SECRET}}` }],
          },
          sendBody: true,
          contentType: "json",
          body: `={{ JSON.stringify($json) }}`,
        },
      },
    ],
    connections: {
      "Meta Lead Ads Trigger": { main: [[{ node: "Map Fields", type: "main", index: 0 }]] },
      "Map Fields": { main: [[{ node: "Send to CRM", type: "main", index: 0 }]] },
    },
    settings: { errorWorkflow: "" },
  };
}

export async function provisionMetaIntegration(params: ProvisionParams): Promise<ProvisionResult> {
  const orgName = params.orgId;

  const creds = await getN8nCredentials(params.orgId);

  const ingestUrl = `${import.meta.env.VITE_API_URL || ''}/webhooks/meta-lead`;
  const ingestSecret = import.meta.env.VITE_N8N_INGEST_SECRET || "";

  const folderId = await ensureFolder(creds.n8n_url, creds.api_key, orgName, params.campaignName);
  const credentialId = await createMetaCredential(
    creds.n8n_url,
    creds.api_key,
    params.metaAccessToken,
    `Meta - ${orgName} - ${params.campaignName}`
  );

  const workflowBody = buildWorkflowTemplate({
    campaignName: params.campaignName,
    integrationId: params.integrationId,
    metaFormId: params.metaFormId,
    credentialId,
    folderId,
    ingestUrl,
    ingestSecret,
    fieldMapping: params.fieldMapping,
  });

  const createRes = await n8nFetch(creds.n8n_url, creds.api_key, "/workflows", {
    method: "POST",
    body: JSON.stringify(workflowBody),
  });
  const workflow = await createRes.json();
  const workflowId = workflow.id as string;

  // Activate
  await n8nFetch(creds.n8n_url, creds.api_key, `/workflows/${workflowId}/activate`, {
    method: "POST",
  });

  return { workflowId, folderId, credentialId };
}

export async function deprovisionMetaIntegration(
  orgId: string,
  workflowId: string,
  credentialId: string
): Promise<void> {
  const creds = await getN8nCredentials(orgId);

  await n8nFetch(creds.n8n_url, creds.api_key, `/workflows/${workflowId}`, { method: "DELETE" });
  await n8nFetch(creds.n8n_url, creds.api_key, `/credentials/${credentialId}`, { method: "DELETE" });
}

export async function setWorkflowActive(orgId: string, workflowId: string, active: boolean): Promise<void> {
  const creds = await getN8nCredentials(orgId);
  const path = active ? `/workflows/${workflowId}/activate` : `/workflows/${workflowId}/deactivate`;
  await n8nFetch(creds.n8n_url, creds.api_key, path, { method: "POST" });
}
