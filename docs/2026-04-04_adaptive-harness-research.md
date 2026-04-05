# Adaptive Harness Research — Industry Patterns & Self-Evolving Agent Systems

> Date: 2026-04-04
> Purpose: Research on systems that automatically adapt AI coding assistant settings based on user behavior patterns

---

## 1. AI Coding Assistant Auto-Adaptation

### 1-1. Windsurf Cascade Memories
- **Source**: [Windsurf Docs - Cascade Memories](https://docs.windsurf.com/windsurf/cascade/memories)
- **Mechanism**: Cascade automatically saves useful context to memory during conversations. When user corrects output ("always use named exports"), it stores as memory and auto-references in future sessions. Stored locally in `~/.codeium/windsurf/memories/`. After ~48 hours of use, learns architecture patterns, coding conventions, and project structure.
- **Applicable idea**: Correction detection → automatic rule addition to `.memory/` or `CLAUDE.md`. "Correction → Rule" pipeline.

### 1-2. GitHub Copilot NES (Next Edit Suggestions)
- **Source**: [GitHub Blog - NES Custom Model Training](https://github.blog/ai-and-ml/github-copilot/evolving-github-copilots-next-edit-suggestions-through-custom-model-training/)
- **Mechanism**: Tracks user accept/dismiss/ignore patterns to adjust suggestion aggressiveness per developer. Trains custom models to adapt to editing style. Continuously improves through A/B experiments and dogfooding.
- **Applicable idea**: Track agent output accept/reject ratios. Learn rules from frequently rejected patterns.

### 1-3. Cursor `/Generate Cursor Rules`
- **Source**: [Cursor Docs - Rules](https://docs.cursor.com/context/rules)
- **Mechanism**: Decisions made during conversation can be auto-generated as `.cursor/rules/*.mdc` files via `/Generate Cursor Rules` command. File pattern-based scoping (glob match) applies rules to relevant files only. Manual trigger but AI-generated content.
- **Applicable idea**: "Auto-suggest rule creation when repeated corrections detected." Similar to our skill system but lacks auto-trigger.

### 1-4. Cline Memory Bank + .clinerules
- **Source**: [Cline Docs - Memory Bank](https://docs.cline.bot/features/memory-bank), [Cline Rules Best Practices](https://cursor-alternatives.com/blog/cline-rules/)
- **Mechanism**: `.clinerules` acts as project-specific "learning journal". Cline discovers and documents patterns/preferences/project intelligence during work. Memory Bank preserves project context, decisions, patterns, and progress across sessions. Self-documenting development system.
- **Applicable idea**: Similar to our `.memory/` system. Key difference: Cline agent automatically discovers and adds rules; ours is manually managed.

---

## 2. Adaptive UI/UX Patterns

### 2-1. AdaptUI Framework
- **Source**: [Springer - AdaptUI Framework](https://link.springer.com/article/10.1007/s11257-024-09414-0)
- **Mechanism**: Observes user behavior in Smart Product-Service Systems and auto-adjusts UI. Continuous learning personalizes interface over time. Maintains consistent adaptation across devices.
- **Applicable idea**: Auto-adjust settings/rule system "values" based on usage frequency. E.g., prioritize frequently used skills.

### 2-2. Adaptive Neural UI Components
- **Source**: [Medium - Adaptive Neural UI Components](https://medium.com/@marketingtd64/how-will-adaptive-neural-ui-components-change-personalization-6a2278d59bf2)
- **Mechanism**: Neural networks embedded directly in UI layer for real-time self-modification based on user behavior and context. On-device/edge inference without server roundtrips. Federated learning for data privacy.
- **Applicable idea**: Local optimization of agent settings. Each agent fine-tunes prompts based on interaction data.

---

## 3. Self-Improving Agent Research

### 3-1. OpenAI Self-Evolving Agents Cookbook
- **Source**: [OpenAI Cookbook - Self-Evolving Agents](https://developers.openai.com/cookbook/examples/partners/self_evolving_agents/autonomous_agent_retraining)
- **Mechanism**: 3-step self-healing workflow: (1) Grader evaluates agent output, (2) Meta-prompt agent rewrites system prompt based on evaluation, (3) Iterate. **Improves settings/prompts only, no model retraining.** GEPA (Genetic-Pareto) framework reflects on agent trajectories and suggests prompt improvements.
- **Applicable idea**: Most directly applicable. "Agent output evaluation → auto-improve CLAUDE.md/skills" loop.

### 3-2. DSPy (Stanford NLP)
- **Source**: [DSPy](https://dspy.ai/), [GitHub - stanfordnlp/dspy](https://github.com/stanfordnlp/dspy)
- **Mechanism**: Instead of writing prompts directly, declare I/O signatures and the **compiler auto-generates optimal prompts**. Optimizers: MIPROv2 (Bayesian Optimization), GEPA (trajectory reflection), BetterTogether (prompt+fine-tuning). Recompile on model switch. Optimization cost: ~$2, 20 minutes.
- **Applicable idea**: Define agent personas as "I/O signatures + metrics" and auto-optimize based on performance data.

### 3-3. Reflexion / Self-Refine / LATS
- **Source**: [LangChain Blog - Reflection Agents](https://blog.langchain.com/reflection-agents/), [Self-Refine](https://learnprompting.org/docs/advanced/self_criticism/self_refine)
- **Mechanism**: **Reflexion**: Learns from verbal feedback and self-reflection. Validates criticism with external data. **Self-Refine**: LLM iteratively improves own output without labeled data or additional models. **LATS**: Monte-Carlo Tree Search + reflection/evaluation, outperforms ReACT/Reflexion.
- **Applicable idea**: Ralph Loop already approximates Reflexion pattern. Apply Self-Refine's "no additional model" improvement pattern to skill auto-improvement.

### 3-4. Self-Evolving Agents Comprehensive Survey (2025)
- **Source**: [arXiv:2508.07407](https://arxiv.org/abs/2508.07407), [arXiv:2507.21046](https://arxiv.org/abs/2507.21046), [GitHub - Awesome-Self-Evolving-Agents](https://github.com/EvoAgentX/Awesome-Self-Evolving-Agents)
- **Mechanism**: Evolution targets (what): model/memory/tools/architecture. Evolution timing (when): intra-test-time / inter-test-time. Evolution methods (how): self-reflection, self-generated data, self-adaptive model. Highlights problem of **most agents remaining static after deployment**. Proposes auto-evolution based on interaction data and environmental feedback.
- **Applicable idea**: Our agent personas/routing rules are currently static. Use this survey's taxonomy to design "what/when/how" evolution system.

### 3-5. Yohei Nakajima - BabyAGI / Self-Building Agent
- **Source**: [Yohei Nakajima - Self-Improving Agents](https://yoheinakajima.com/better-ways-to-build-self-improving-ai-agents/), [GitHub - BabyAGI](https://github.com/yoheinakajima/babyagi)
- **Mechanism**: BabyAGI 2 uses functionz framework to store functions and metadata in DB. Agent loads/executes/updates functions to **build itself**. Categorizes across 5 axes: self-reflection, self-generated data, self-adaptive model, code agent self-improvement.
- **Applicable idea**: Treat skills (SKILL.md) as "functions" that agents can auto-create/modify/optimize.

---

## 4. Developer Tools Auto-Configuration

### 4-1. Arize AI - Coding Agent Rules Optimization
- **Source**: [Arize AI - Optimizing Coding Agent Rules](https://arize.com/blog/optimizing-coding-agent-rules-claude-md-agents-md-clinerules-cursor-rules-for-improved-accuracy/)
- **Mechanism**: Research on measuring and optimizing effectiveness of coding agent rule files (`.clinerules`, `CLAUDE.md`, `.cursor/rules`). Quantitative analysis of each rule's accuracy impact.
- **Applicable idea**: Grader system to measure compliance and effectiveness per CLAUDE.md rule. Remove ineffective rules, strengthen effective ones.

### 4-2. ai-project-setup-script (Universal AI Setup)
- **Source**: [GitHub - dazeb/ai-project-setup-script](https://github.com/dazeb/ai-project-setup-script)
- **Mechanism**: Universal script auto-generating config files for GitHub Copilot, Cline, Cursor, Windsurf, Augment, Roo Code. Project analysis-based auto-configuration of rules/templates/MCP tools.
- **Applicable idea**: Auto-scaffolding of persona files/skills/hooks when adding new agents.

---

## 5. Claude Code Ecosystem

### 5-1. Awesome Claude Code
- **Source**: [GitHub - hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)
- **Mechanism**: Curated list of Claude Code skills/agents/plugins/hooks/tools. Community tools include cc-tools (Go-based high-performance hooks), agnix (agent file linter), cc-sessions (session management).
- **Applicable idea**: Use agnix for agent file auto-validation, cc-tools for hook performance improvement.

### 5-2. Skills Auto-Activation via Hooks
- **Source**: [paddo.dev - Skills Auto-Activation](https://paddo.dev/blog/claude-skills-hooks-solution/)
- **Mechanism**: Pattern for auto-activating skills via hooks. Hooks are deterministic, skills are probabilistic. 100% compliance rules → hooks, judgment-allowed rules → skills.
- **Applicable idea**: Reinforce skill auto-invocation triggers with hook-based enforcement for reliability.

---

## Key Insights for Our System (TOP 5)

### 1. "Correction → Rule" Auto-Pipeline (Windsurf Pattern)
Detect user corrections → auto-add as rules after 3 occurrences. Easiest to implement, highest impact. Windsurf already operates this successfully in production.

### 2. Grader + Meta-Prompt Self-Healing Loop (OpenAI Pattern)
Auto-evaluate agent output (grader) → auto-rewrite system prompt (persona) based on evaluation. Practical because it evolves settings only, no model retraining. Can be implemented by extending Ralph Loop.

### 3. Rule Effectiveness Measurement (Arize Pattern)
Quantitatively track compliance rate and actual effect of each rule. Remove unused rules, strengthen effective ones. Solves the 500+ line bloated CLAUDE.md problem with data.

### 4. Deterministic Rules → Hooks, Judgment Rules → Skills (paddo.dev Pattern)
100% compliance rules → hooks (code enforcement), judgment-allowed rules → skills (prompt guidance). Clear separation reduces rule violation while maintaining flexibility.

### 5. What/When/How Evolution Framework (Self-Evolving Agents Survey)
Systematically classify evolution targets: (what) persona/routing rules/skills, (when) on session end / on correction / periodic, (how) reflection-based / metric-based / voting-based. Provides architectural blueprint for auto-evolution system.
