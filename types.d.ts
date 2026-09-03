import type { ZodRawShape } from "zod";

export type StatusType = "stable" | "experimental";

export interface IMCPTool {
  name: string;
  description: string;
  enabled: boolean;
  status: StatusType;
}

export interface IMCPPrompt {
  name: string;
  description: string;
  arguments: ZodRawShape;
  enabled: boolean;
  status: StatusType;
}

export interface IMCPResource {
  name: string;
  description: string;
  uriTemplate: string;
}
