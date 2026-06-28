import { useMemo, useState } from "react";

const examples = [
  "帮我分析一下这个产品的用户反馈，看看哪里可以优化，最后给我一个比较专业的结果。",
  "帮我写一份新能源车市场分析，要专业一点，最好能给老板看。",
  "我想让AI帮我改简历，突出项目经历，适合投AI产品经理岗位。",
  "根据用户评论找出App的问题，然后给一些优化建议。"
];

const domainWords = {
  product: ["产品", "用户", "反馈", "app", "功能", "体验", "需求", "优化"],
  business: ["市场", "竞品", "商业", "销售", "增长", "老板", "战略", "行业"],
  content: ["文案", "文章", "脚本", "小红书", "公众号", "标题", "改写"],
  data: ["数据", "分析", "指标", "表格", "样本", "来源", "统计"],
  coding: ["代码", "接口", "bug", "函数", "组件", "报错", "架构"],
  research: ["研究", "报告", "论文", "资料", "趋势", "政策", "时间范围"]
};

const domainName = {
  product: "产品与用户洞察",
  business: "商业分析",
  content: "内容生成",
  data: "数据分析",
  coding: "代码工程",
  research: "研究报告"
};

const questionBank = {
  data: {
    question: "你将提供哪些明确数据、材料、样本或来源？",
    reason: "数据不明确时，系统不能虚构关键事实。"
  },
  output: {
    question: "最终输出希望是什么形式：报告、表格、结论清单、方案还是可执行计划？",
    reason: "输出格式决定模型的结构和颗粒度。"
  },
  constraints: {
    question: "是否存在字数、语气、时间范围、行业范围、合规或禁用内容限制？",
    reason: "约束不明确会导致结果不可直接使用。"
  },
  scenario: {
    question: "这个结果将用于什么具体场景，例如汇报、发布、投递、决策或自动执行？",
    reason: "场景决定深度、角色和执行方式。"
  },
  criteria: {
    question: "你希望用什么标准判断结果好不好，例如准确性、可执行性、创新性或成本收益？",
    reason: "评价标准会影响建议的优先级。"
  }
};

function detectDomain(text) {
  const lower = text.toLowerCase();
  let best = "product";
  let score = 0;
  Object.entries(domainWords).forEach(([key, words]) => {
    const hits = words.reduce((sum, word) => sum + (lower.includes(word.toLowerCase()) ? 1 : 0), 0);
    if (hits > score) {
      best = key;
      score = hits;
    }
  });
  return score ? best : "business";
}

function classifyIntent(text) {
  if (/(agent|自动|流程|步骤|执行|任务拆解|多步)/i.test(text)) return "AGENT";
  if (/(计划|规划|路线图|策略|安排)/i.test(text)) return "PLANNING";
  if (/(写|生成|创作|改写|输出|制作)/i.test(text)) return "GENERATION";
  return "ANALYSIS";
}

function inferGoal(text, intent) {
  const lower = text.toLowerCase();
  if (lower.includes("反馈") || lower.includes("评论")) {
    return "从用户反馈中识别主要问题、机会点和优先级，并形成可执行优化建议。";
  }
  if (lower.includes("市场") || lower.includes("行业")) {
    return "形成结构化市场判断，支持管理层或业务决策。";
  }
  if (lower.includes("简历")) {
    return "优化简历表达，使经历更匹配目标岗位并提升筛选通过率。";
  }
  if (lower.includes("代码") || lower.includes("bug")) {
    return "定位技术问题、解释原因并给出可验证修复方案。";
  }
  if (intent === "GENERATION") return "将原始想法转化为可直接使用的高质量内容。";
  if (intent === "PLANNING") return "把目标拆成清晰路径、优先级和可执行动作。";
  if (intent === "AGENT") return "把复杂目标转化为多步 Agent 执行计划。";
  return "将模糊需求转化为明确、结构化、可执行的 AI 任务。";
}

function cleanPrompt(text) {
  const fillers = ["帮我", "一下", "看看", "比较", "最好", "给我", "这个", "那个", "大概", "随便", "要专业一点"];
  let result = text.trim().replace(/\s+/g, " ");
  fillers.forEach((word) => {
    result = result.replaceAll(word, "");
  });
  return result.replace(/[，,。.\s]+$/g, "").trim() || text.trim();
}

function missingInfo(text) {
  const missing = [];
  if (!/(数据|材料|来源|评论|文件|表格|输入|链接|文本|样本|日志|代码|反馈)/i.test(text)) missing.push("data");
  if (!/(报告|表格|清单|json|markdown|结论|方案|ppt|邮件|prompt|格式|结构)/i.test(text)) missing.push("output");
  if (!/(字数|不要|必须|限制|约束|语气|合规|保密|长度|时间|地区|行业|范围|版本|周期|近|202|月份|国内|海外)/i.test(text)) missing.push("constraints");
  if (!/(场景|用于|给.*看|老板|客户|用户|团队|面试官|读者|受众|管理层|开发者|投递|汇报|发布)/i.test(text)) missing.push("scenario");
  if (!/(标准|指标|优先级|评分|准确|成本|收益|风险|可行)/i.test(text)) missing.push("criteria");
  return missing;
}

function hasExplicitGoal(text) {
  return /(目标|目的|希望|为了|想要|需要|分析|生成|写|规划|优化|诊断|总结|提取|对比|评估)/i.test(text);
}

function completenessScore(text, missing) {
  const dimensions = [
    { key: "goal", label: "明确目标", ok: hasExplicitGoal(text), weight: 30 },
    { key: "data", label: "输入数据", ok: !missing.includes("data"), weight: 25 },
    { key: "output", label: "输出要求", ok: !missing.includes("output"), weight: 25 },
    { key: "constraints", label: "约束条件", ok: !missing.includes("constraints"), weight: 20 }
  ];
  const score = dimensions.reduce((sum, item) => sum + (item.ok ? item.weight : 0), 0);
  const level = score >= 80 ? "High" : score >= 50 ? "Medium" : "Low";
  return { score, level, dimensions };
}

function riskLevel(missing, completeness, questions) {
  const hallucinationRisk = missing.includes("data") || missing.includes("constraints");
  const insufficientInfo = missing.length >= 3 || completeness.score < 60;
  const needsClarification = questions.length > 0;
  let level = "Low";
  if (hallucinationRisk && insufficientInfo) level = "High";
  else if (hallucinationRisk || insufficientInfo || needsClarification) level = "Medium";
  return { level, hallucinationRisk, insufficientInfo, needsClarification };
}

function buildSuggestions(analysisSeed) {
  const { goal, missing, schemas, compact, questions } = analysisSeed;
  const suggestions = {
    rewrite: `把原始 Prompt 改写为：请基于【输入材料】完成任务：${goal}。输出需包含【${schemas.output.slice(0, 3).join(" / ")}】，并标注依据、风险和下一步行动。`,
    supplement: [],
    execution: []
  };

  if (missing.includes("data")) suggestions.supplement.push("补充具体数据来源、样本、链接、文件或原始文本，避免模型凭空推断事实。");
  if (missing.includes("output")) suggestions.supplement.push("明确输出格式，例如报告、表格、JSON、结论清单、PPT大纲或执行计划。");
  if (missing.includes("constraints")) suggestions.supplement.push("补充范围、时间、语气、字数、合规、行业或禁用内容等约束。");
  if (missing.includes("scenario")) suggestions.supplement.push("说明使用场景和目标读者，例如老板汇报、客户方案、团队执行或公开发布。");
  if (missing.includes("criteria")) suggestions.supplement.push("定义评价标准，例如准确性、可执行性、优先级、成本收益或创新性。");
  if (!suggestions.supplement.length) suggestions.supplement.push("当前信息较完整，可补充更多背景样例来提升输出稳定性。");

  suggestions.execution.push("把任务拆成目标、输入、约束、输出四段，让模型先确认理解再生成结果。");
  suggestions.execution.push("要求模型对不确定内容提出问题，不要把缺失信息写成事实。");
  suggestions.execution.push(`保留压缩后的核心需求：“${compact}”，并删除口语化铺垫。`);
  if (questions.length) suggestions.execution.push("先回答 Clarification Questions 中的关键问题，再执行最终生成。");

  return suggestions;
}

function buildSchemas(domain, text) {
  if (domain === "product" || /反馈|评论|用户/i.test(text)) {
    return {
      input: ["产品/功能名称", "用户反馈数据", "用户分层或画像", "业务目标", "时间范围与约束"],
      output: ["核心洞察", "问题分类与证据", "优先级矩阵", "优化建议", "验证指标"]
    };
  }
  if (domain === "coding") {
    return {
      input: ["代码上下文", "报错信息", "期望行为", "实际行为", "技术栈限制"],
      output: ["根因分析", "修复方案", "代码修改建议", "测试方式", "剩余风险"]
    };
  }
  return {
    input: ["目标", "背景", "输入材料", "约束条件", "成功标准"],
    output: ["摘要", "结构化分析", "建议", "风险", "下一步行动"]
  };
}

function complexityScore(text, missing, intent) {
  let score = 1;
  if (text.length > 60) score += 1;
  if (/[，,；;、]/.test(text)) score += 1;
  if (/(分析|优化|方案|报告|策略|拆解|计划|研究|诊断)/.test(text)) score += 1;
  if (missing.length >= 3) score += 1;
  if (intent === "AGENT") score += 1;
  return Math.min(score, 5);
}

function analyzePrompt(text) {
  const source = text.trim();
  if (!source) return null;
  const intent = classifyIntent(source);
  const domain = detectDomain(source);
  const goal = inferGoal(source, intent);
  const compact = cleanPrompt(source);
  const missing = missingInfo(source);
  const schemas = buildSchemas(domain, source);
  const complexity = complexityScore(source, missing, intent);
  const questions = missing.slice(0, 5).map((key) => ({ key, ...questionBank[key] }));
  const completeness = completenessScore(source, missing);
  const risk = riskLevel(missing, completeness, questions);

  const expandedPrompt = `任务：
[推断内容] ${goal}

输入：
[推断内容] 请提供以下输入结构：
${schemas.input.map((item) => `- ${item}`).join("\n")}

约束：
[推断内容] 不得虚构用户未提供的关键数据；不确定信息必须转为澄清问题；所有补全内容标注为“推断内容”。

输出：
[推断内容] 请按以下输出结构交付：
${schemas.output.map((item) => `- ${item}`).join("\n")}`;

  const optimizedPrompt = `你是${domainName[domain]}专家。请基于用户提供的信息完成 ${intent} 任务。

目标：${goal}

输入要求：
${schemas.input.map((item) => `- ${item}`).join("\n")}

输出要求：
${schemas.output.map((item) => `- ${item}`).join("\n")}

规则：
- 去除冗余表达，直接输出可执行结果。
- 不得虚构关键数据、来源、指标或时间范围。
- 缺失信息先提出最多 5 个澄清问题。
- 系统补全内容必须标注为“推断内容”。

用户原始需求：${compact}`;

  const agentPlan = complexity >= 4 || intent === "AGENT"
    ? [
        "Step 1：读取原始 Prompt，确认任务分类、目标、业务意图和交付对象。",
        "Step 2：检测数据、输出格式、约束、场景、评价标准的缺失项，并生成澄清问题。",
        "Step 3：基于已提供信息和标注为“推断内容”的补全结构执行任务，不虚构关键事实。",
        "Step 4：按输出结构生成最终结果，并补充风险、优先级和下一步行动。"
      ]
    : [];
  const suggestions = buildSuggestions({ goal, missing, schemas, compact, questions });

  return {
    intent,
    domain,
    goal,
    compact,
    missing,
    schemas,
    questions,
    expandedPrompt,
    optimizedPrompt,
    agentPlan,
    complexity,
    completeness,
    risk,
    suggestions
  };
}

function App() {
  const [prompt, setPrompt] = useState(examples[0]);
  const [activeTab, setActiveTab] = useState("intent");
  const [mode, setMode] = useState("auto");

  const analysis = useMemo(() => analyzePrompt(prompt), [prompt]);

  const handleExample = () => {
    const current = examples.indexOf(prompt);
    setPrompt(examples[(current + 1 + examples.length) % examples.length]);
  };

  const handleOptimize = () => {
    setMode("optimized");
    setActiveTab("optimized");
  };

  const handleExpand = () => {
    setMode("expanded");
    setActiveTab("expanded");
  };

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Prompt Intelligence System</p>
          <h1>Prompt OS 2.5</h1>
        </div>
        <div className="status-row">
          <span>Auto Analysis</span>
          <strong>{analysis?.intent ?? "READY"}</strong>
          {analysis ? <em>{analysis.completeness.score}/100</em> : null}
        </div>
      </header>

      <main className="workspace">
        <section className="card input-card">
          <div className="section-head">
            <div>
              <h2>Input</h2>
              <p>输入 Prompt 后系统自动分析，Expand 与 Optimize 可切换重点结果。</p>
            </div>
          </div>

          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="输入一个口语化或不完整 Prompt..."
            spellCheck="false"
          />

          <div className="button-grid">
            <button type="button" className="secondary" onClick={handleExample}>Example</button>
            <button type="button" className="primary" onClick={handleOptimize}>Optimize</button>
            <button type="button" className="primary dark" onClick={handleExpand}>Expand</button>
          </div>

          <div className="hint-panel">
            <h3>Missing Information</h3>
            {analysis?.missing.length ? (
              <div className="chips">
                {analysis.missing.map((item) => (
                  <span key={item}>{missingLabel[item]}</span>
                ))}
              </div>
            ) : (
              <p>核心信息完整，可以直接生成。</p>
            )}
          </div>

          {analysis ? (
            <div className="score-panel">
              <div>
                <span>Completeness</span>
                <strong>{analysis.completeness.score}</strong>
                <em>{analysis.completeness.level}</em>
              </div>
              <div>
                <span>Risk Level</span>
                <strong>{analysis.risk.level}</strong>
                <em>{analysis.questions.length ? "Needs questions" : "Ready"}</em>
              </div>
            </div>
          ) : null}
        </section>

        <section className="card output-card">
          <div className="tabs" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? "tab active" : "tab"}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="output-body">
            {!analysis ? <Empty /> : <TabContent tab={activeTab} analysis={analysis} mode={mode} />}
          </div>
        </section>
      </main>
    </div>
  );
}

const tabs = [
  { id: "intent", label: "Intent" },
  { id: "expanded", label: "Expanded Prompt" },
  { id: "optimized", label: "Optimized Prompt" },
  { id: "questions", label: "Clarification Questions" },
  { id: "agent", label: "Agent Plan" }
];

const missingLabel = {
  data: "数据未明确",
  output: "输出格式未明确",
  constraints: "约束未明确",
  scenario: "场景未明确",
  criteria: "评价标准未明确"
};

function TabContent({ tab, analysis, mode }) {
  if (tab === "intent") {
    return (
      <div className="intent-stack">
        <div className="score-grid">
          <ScoreCard title="Prompt Completeness Score" value={`${analysis.completeness.score}/100`} level={analysis.completeness.level} />
          <ScoreCard title="Prompt Risk Level" value={analysis.risk.level} level={analysis.risk.level} />
        </div>
        <div className="grid-two">
          <InfoBlock title="Task Classification" value={analysis.intent} strong />
          <InfoBlock title="Detected Domain" value={domainName[analysis.domain]} />
          <InfoBlock title="Reconstructed Goal" value={analysis.goal} wide />
          <InfoBlock title="Mode Focus" value={mode === "expanded" ? "Expanded Prompt" : mode === "optimized" ? "Optimized Prompt" : "Auto Analysis"} />
        </div>
        <CompletenessBreakdown completeness={analysis.completeness} />
        <RiskBreakdown risk={analysis.risk} />
        <SuggestionPanel suggestions={analysis.suggestions} />
      </div>
    );
  }

  if (tab === "expanded") {
    return <PreBlock title="Expanded Prompt" text={analysis.expandedPrompt} />;
  }

  if (tab === "optimized") {
    return <PreBlock title="Optimized Prompt" text={analysis.optimizedPrompt} />;
  }

  if (tab === "questions") {
    return analysis.questions.length ? (
      <div className="question-list">
        {analysis.questions.map((item, index) => (
          <div className="question" key={item.key}>
            <b>Q{index + 1}. {item.question}</b>
            <p>{item.reason}</p>
          </div>
        ))}
      </div>
    ) : (
      <Empty text="当前信息较完整，没有必须反问项。" />
    );
  }

  if (tab === "agent") {
    return analysis.agentPlan.length ? (
      <div className="agent-list">
        {analysis.agentPlan.map((step) => (
          <div className="agent-step" key={step}>
            <span>{step.split("：")[0]}</span>
            <p>{step.split("：").slice(1).join("：")}</p>
          </div>
        ))}
      </div>
    ) : (
      <Empty text="当前任务复杂度较低，不需要 Agent Plan。" />
    );
  }

  return null;
}

function InfoBlock({ title, value, strong = false, wide = false }) {
  return (
    <div className={wide ? "info-block wide" : "info-block"}>
      <span>{title}</span>
      <p className={strong ? "classification" : ""}>{value}</p>
    </div>
  );
}

function ScoreCard({ title, value, level }) {
  return (
    <div className="score-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <em className={`level ${level.toLowerCase()}`}>{level}</em>
    </div>
  );
}

function CompletenessBreakdown({ completeness }) {
  return (
    <div className="analysis-card">
      <h3>Completeness Dimensions</h3>
      <div className="dimension-list">
        {completeness.dimensions.map((item) => (
          <div className="dimension-row" key={item.key}>
            <span>{item.label}</span>
            <b>{item.ok ? "Yes" : "No"}</b>
            <i>{item.weight} pts</i>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskBreakdown({ risk }) {
  const rows = [
    ["容易产生幻觉", risk.hallucinationRisk],
    ["信息不足", risk.insufficientInfo],
    ["需要反问", risk.needsClarification]
  ];
  return (
    <div className="analysis-card">
      <h3>Risk Signals</h3>
      <div className="dimension-list">
        {rows.map(([label, active]) => (
          <div className="dimension-row" key={label}>
            <span>{label}</span>
            <b>{active ? "Yes" : "No"}</b>
            <i>{active ? "Active" : "Clear"}</i>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuggestionPanel({ suggestions }) {
  return (
    <div className="analysis-card">
      <h3>Suggestion Engine</h3>
      <div className="suggestion-group">
        <span>如何改写 Prompt</span>
        <p>{suggestions.rewrite}</p>
      </div>
      <div className="suggestion-group">
        <span>如何补充信息</span>
        <ul>
          {suggestions.supplement.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
      <div className="suggestion-group">
        <span>如何提升可执行性</span>
        <ul>
          {suggestions.execution.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
    </div>
  );
}

function PreBlock({ title, text }) {
  return (
    <div className="pre-wrap">
      <div className="pre-title">{title}</div>
      <pre>{text}</pre>
    </div>
  );
}

function Empty({ text = "输入 Prompt 后查看分析结果。" }) {
  return <div className="empty">{text}</div>;
}

export default App;
