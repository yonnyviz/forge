import type { Component } from "@earendil-works/pi-tui";
import { truncateToWidth } from "@earendil-works/pi-tui";
import type { ExtensionContext, ReadonlyFooterDataProvider } from "@earendil-works/pi-coding-agent";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface InitiativeMetadata {
  goal?: string;
  phase?: string;
  [key: string]: any;
}

export class ForgeFooterComponent implements Component {
  constructor(
    private ctx: ExtensionContext,
    private footerData: ReadonlyFooterDataProvider,
    private theme: Theme
  ) {}

  render(width: number): string[] {
    const line = this.buildFooterLine();
    const truncated = truncateToWidth(line, width, "...");
    return [this.theme.fg("dim", truncated)];
  }

  private buildFooterLine(): string {
    const parts: string[] = [];

    // 1. Context window: 50%/200k
    parts.push(this.getContextString());

    // 2. Cost: $0.023
    parts.push(this.getCostString());

    // 3. Model: claude-3.5-sonnet
    const modelName = this.ctx.model?.id || "no-model";
    parts.push(modelName);

    // 4. Thinking level: [medium] (only if not off)
    if (this.ctx.thinkingLevel && this.ctx.thinkingLevel !== "off") {
      parts.push(`[${this.ctx.thinkingLevel}]`);
    }

    // 5-7. Phase icon + phase + goal
    const initiative = this.getCurrentInitiative();
    if (initiative) {
      const phaseIcon = this.getPhaseIcon(initiative.phase);
      const phase = initiative.phase || "planning";
      parts.push(`${phaseIcon} ${phase}`);
      const goal = initiative.goal || "(no goal)";
      parts.push(goal);
    } else {
      parts.push("(no active initiative)");
    }

    // Join with bullet separator
    return parts.join(" · ");
  }

  private getContextString(): string {
    const usage = this.ctx.getContextUsage();
    const contextWindow = usage?.contextWindow ?? this.ctx.model?.contextWindow ?? 0;
    const contextPercent = usage?.percent ?? 0;

    const percentStr =
      usage?.percent !== null ? `${contextPercent.toFixed(0)}%` : "?%";
    return `${percentStr}/${this.formatTokens(contextWindow)}`;
  }

  private getCostString(): string {
    let totalCost = 0;

    for (const entry of this.ctx.sessionManager.getEntries()) {
      if (entry.type === "message" && entry.message.usage) {
        const usage = entry.message.usage;
        // Simplified cost calculation
        // In production, use actual model pricing
        totalCost += (usage.input ?? 0) * 0.001;
        totalCost += (usage.output ?? 0) * 0.002;
      }
    }

    return `$${totalCost.toFixed(3)}`;
  }

  private formatTokens(count: number): string {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(0)}k`;
    return `${(count / 1000000).toFixed(1)}M`;
  }

  private getPhaseIcon(phase: string): string {
    const icons: Record<string, string> = {
      planning: "📋",
      execution: "⚙️",
      review: "🔍",
      complete: "✅",
    };
    return icons[phase] || "◉";
  }

  private getCurrentInitiative(): InitiativeMetadata | null {
    try {
      const path = resolve(this.ctx.cwd);
      const metadataPath = join(path, ".forge", "metadata.json");

      if (!existsSync(metadataPath)) {
        return null;
      }

      const content = readFileSync(metadataPath, "utf8");
      const metadata = JSON.parse(content);
      return metadata;
    } catch {
      return null;
    }
  }

  dispose() {
    // Cleanup if needed
  }
}
