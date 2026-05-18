import React from "react";
import { bezierPath } from "../../lib/graphLayout";

interface Props {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
}

export function BezierConnector({ fromX, fromY, toX, toY, color }: Props) {
  return (
    <path
      d={bezierPath(fromX, fromY, toX, toY)}
      stroke={color}
      strokeWidth={1.5}
      fill="none"
      opacity={0.7}
    />
  );
}
