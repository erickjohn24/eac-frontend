import Anthropic from "@anthropic-ai/sdk";
import { ISIC_ACTIVITIES } from "@tz/shared";

export interface BusinessUnderstanding {
  suggestedNames: string[];
  activities: { code: string; label: string }[];
  activityDescription: string;
  vatLikely: boolean;
  employeesLikely: boolean;
  /** short friendly one-liner echoing what we understood */
  summary: string;
  source: "ai" | "heuristic";
}

const KEYWORDS: { match: RegExp; codes: string[] }[] = [
  { match: /\b(software|app|saas|platform|develop|coding|web|mobile app)\b/i, codes: ["6201", "6202"] },
  { match: /\b(it |consult|technolog|systems)\b/i, codes: ["6202", "7020"] },
  { match: /\b(shop|retail|store|sell goods|boutique|supermarket)\b/i, codes: ["4711", "4791"] },
  { match: /\b(online|e-?commerce|marketplace)\b/i, codes: ["4791", "6201"] },
  { match: /\b(restaurant|food|cafe|catering|kitchen)\b/i, codes: ["5610", "1071"] },
  { match: /\b(hotel|lodge|accommodation|guest house)\b/i, codes: ["5510"] },
  { match: /\b(tour|safari|travel|tourism)\b/i, codes: ["7911", "5510"] },
  { match: /\b(transport|logistics|freight|delivery|haulage)\b/i, codes: ["4923"] },
  { match: /\b(farm|agri|crop|produce|livestock)\b/i, codes: ["0111", "0141"] },
  { match: /\b(construction|contractor|civil works|real estate develop)\b/i, codes: ["4100"] },
  { match: /\b(consult|advisory|management)\b/i, codes: ["7020"] },
  { match: /\b(legal|law|advocate)\b/i, codes: ["6910"] },
  { match: /\b(account|bookkeep|audit|tax)\b/i, codes: ["6920"] },
  { match: /\b(school|training|education|teach|academy)\b/i, codes: ["8559"] },
  { match: /\b(health|clinic|medical|hospital|pharmac)\b/i, codes: ["8690"] },
  { match: /\b(design|creative|brand|marketing)\b/i, codes: ["7410", "5911"] },
  { match: /\b(fintech|payment|wallet|lending|microfinance)\b/i, codes: ["6612", "6419"] },
  { match: /\b(real estate|property|rental)\b/i, codes: ["6820"] },
  { match: /\b(wholesale|distribut|import|export)\b/i, codes: ["4632"] },
];

function heuristic(text: string): BusinessUnderstanding {
  const found = new Set<string>();
  for (const k of KEYWORDS) if (k.match.test(text)) k.codes.forEach((c) => found.add(c));
  if (found.size === 0) found.add("7020");
  const activities = [...found]
    .map((code) => ISIC_ACTIVITIES.find((a) => a.code === code))
    .filter((a): a is { code: string; label: string } => Boolean(a))
    .slice(0, 4);

  const core = text.trim().replace(/\.$/, "");
  const firstWord = (activities[0]?.label ?? "Trading").split(" ")[0]!;
  const suggestedNames = [
    `${capitalize(firstWord)} Hub`,
    `Jenga ${capitalize(firstWord)}`,
    `${capitalize(firstWord)} Africa`,
  ].map((n) => `${n} Limited`);

  return {
    suggestedNames,
    activities,
    activityDescription: core.length > 12 ? core : `${activities[0]?.label ?? "General business"} in Tanzania`,
    vatLikely: /\b(wholesale|import|export|manufactur|hotel|construct)\b/i.test(text),
    employeesLikely: /\b(team|staff|employ|hire|workshop|factory|shop|restaurant|hotel)\b/i.test(text),
    summary: `Got it — ${activities.map((a) => a.label.toLowerCase()).slice(0, 2).join(" and ") || "your business"}.`,
    source: "heuristic",
  };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function understandBusiness(text: string): Promise<BusinessUnderstanding> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return heuristic(text);

  try {
    const client = new Anthropic({ apiKey });
    const catalog = ISIC_ACTIVITIES.map((a) => `${a.code}: ${a.label}`).join("\n");
    const msg = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 700,
      system:
        "You help entrepreneurs incorporate a company in Tanzania. From a plain-language business description, infer the registration essentials. Only choose activity codes from the provided ISIC catalog. Company names must end in 'Limited'. Be concise and practical.",
      messages: [
        {
          role: "user",
          content: `Business description: "${text}"\n\nISIC catalog:\n${catalog}\n\nReturn ONLY JSON:\n{"suggestedNames":["...Limited","...Limited","...Limited"],"activityCodes":["6201"],"activityDescription":"one clean sentence for the company objects","vatLikely":false,"employeesLikely":false,"summary":"friendly one-liner of what you understood"}`,
        },
      ],
    });
    const t = msg.content.find((c) => c.type === "text");
    if (!t || t.type !== "text") return heuristic(text);
    const json = JSON.parse(t.text.slice(t.text.indexOf("{"), t.text.lastIndexOf("}") + 1));
    const activities = (json.activityCodes as string[])
      .map((code) => ISIC_ACTIVITIES.find((a) => a.code === code))
      .filter((a): a is { code: string; label: string } => Boolean(a));
    return {
      suggestedNames: json.suggestedNames ?? [],
      activities: activities.length ? activities : heuristic(text).activities,
      activityDescription: json.activityDescription ?? text,
      vatLikely: Boolean(json.vatLikely),
      employeesLikely: Boolean(json.employeesLikely),
      summary: json.summary ?? "Understood.",
      source: "ai",
    };
  } catch {
    return heuristic(text);
  }
}
