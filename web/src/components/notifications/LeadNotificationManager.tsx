import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNewLeadNotification } from "@/hooks/useNewLeadNotification";
import { NotificationPermissionPrompt } from "@/components/mobile/NotificationPermissionPrompt";

export function LeadNotificationManager() {
  const { profile } = useAuth();
  const { requestNotificationPermission } = useNewLeadNotification(profile?.id);

  useEffect(() => {
    // Request notification permission on mount
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  return <NotificationPermissionPrompt onGranted={() => {}} />;
}
