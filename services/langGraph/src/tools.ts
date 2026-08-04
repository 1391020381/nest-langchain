import { tool } from "@langchain/core/tools";
import { z } from "zod";

const REQUIREMENTS: Record<string, Record<string, unknown>> = {
  "REQ-001": {
    id: "REQ-001",
    title: "用户敏感数据导出",
    description: "管理员导出用户手机号和身份证信息",
    status: "reviewing",
  },
  "REQ-002": {
    id: "REQ-002",
    title: "批量导入用户",
    description: "通过 Excel 批量导入最多一万名用户",
    status: "draft",
  },
};

export const searchRequirementTool = tool(
  async ({ reqId }) =>
    JSON.stringify(
      REQUIREMENTS[reqId] ?? { error: `没有找到需求 ${reqId}` },
    ),
  {
    name: "search_requirement",
    description: "根据 REQ 编号查询需求详情；输入包含需求编号时优先调用。",
    schema: z.object({ reqId: z.string().describe("例如 REQ-001") }),
  },
);

export const checkConflictsTool = tool(
  async ({ description }) => {
    const hasExportConflict = /导出|下载/.test(description);
    return JSON.stringify({
      hasConflict: hasExportConflict,
      conflicts: hasExportConflict ? ["系统已存在旧版 CSV 导出功能"] : [],
      suggestion: hasExportConflict
        ? "复用已有异步导出任务，避免出现两套导出逻辑"
        : "未发现明显功能冲突",
    });
  },
  {
    name: "check_conflicts",
    description: "检查新需求和现有功能是否冲突或重复。",
    schema: z.object({ description: z.string() }),
  },
);

export const loadPerformanceBaselineTool = tool(
  async ({ service }) =>
    JSON.stringify({
      service,
      p95: "180ms",
      peakQps: 350,
      cpu: "55%",
      memory: "62%",
    }),
  {
    name: "load_performance_baseline",
    description: "读取指定服务当前的 P95、峰值 QPS 和资源基线。",
    schema: z.object({ service: z.string() }),
  },
);

export const checkSecurityPolicyTool = tool(
  async ({ operation, dataTypes }) => {
    const sensitiveTypes = ["手机号", "身份证", "密码", "银行卡"];
    const detected = dataTypes.filter((item) =>
      sensitiveTypes.some((type) => item.includes(type)),
    );
    return JSON.stringify({
      operation,
      sensitiveDataDetected: detected,
      requirements:
        detected.length > 0
          ? ["权限校验", "审计日志", "文件有效期", "敏感字段默认脱敏"]
          : ["常规权限校验"],
    });
  },
  {
    name: "check_security_policy",
    description: "查询操作涉及的安全策略；涉及敏感数据时必须调用。",
    schema: z.object({
      operation: z.string(),
      dataTypes: z.array(z.string()),
    }),
  },
);

export const checkComplianceTool = tool(
  async ({ dataTypes, regions }) =>
    JSON.stringify({
      laws: ["个人信息保护法"],
      dataTypes,
      regions,
      requirements: ["最小必要", "明确授权", "保留期限", "删除机制"],
      crossBorderReviewRequired: regions.length > 1,
    }),
  {
    name: "check_compliance",
    description: "检查个人信息、数据地域和跨境场景的合规要求。",
    schema: z.object({
      dataTypes: z.array(z.string()),
      regions: z.array(z.string()),
    }),
  },
);
