import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Shuffle } from "lucide-react";

export const AbSplitNode = memo(({ data, selected }: NodeProps) => {
  const config = (data as any).config || {};
  const splitA = config.split_a ?? 50;

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 shadow-md bg-card min-w-[220px] ${
        selected ? "border-pink-500 shadow-pink-500/20" : "border-pink-500/30"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-pink-500 !w-3 !h-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-md bg-pink-500/10">
          <Shuffle className="h-4 w-4 text-pink-500" />
        </div>
        <span className="text-xs font-poppins font-bold text-pink-500 uppercase tracking-wide">
          A/B Split
        </span>
      </div>
      <p className="text-sm font-poppins text-foreground leading-snug">
        {splitA}% → A / {100 - splitA}% → B
      </p>

      <div className="flex justify-between mt-3 px-2">
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-poppins font-semibold text-blue-500 mb-1">
            A ({splitA}%)
          </span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="a"
            style={{ left: 0, position: "relative" }}
            className="!bg-blue-500 !w-3 !h-3 !border-2 !border-background !relative !transform-none"
          />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-poppins font-semibold text-purple-500 mb-1">
            B ({100 - splitA}%)
          </span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="b"
            style={{ left: 0, position: "relative" }}
            className="!bg-purple-500 !w-3 !h-3 !border-2 !border-background !relative !transform-none"
          />
        </div>
      </div>
    </div>
  );
});

AbSplitNode.displayName = "AbSplitNode";
