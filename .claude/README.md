# .claude Directory

Claude Code設定ディレクトリ - プロジェクト固有の設定とプロンプト

## 構造

- `agents/` - Agent仕様とプロンプト
  - `specs/coding/` - コーディング系Agent仕様
  - `specs/business/` - ビジネス系Agent仕様
  - `prompts/coding/` - 実行プロンプト
- `commands/` - カスタムスラッシュコマンド
- `prompts/` - 汎用プロンプト
- `templates/` - テンプレートファイル

## カスタムコマンド

`.claude/commands/` 配下に `*.md` ファイルを作成することで、
カスタムスラッシュコマンドを定義できます。

例: `.claude/commands/test.md` → `/test` コマンド

## Agent仕様

Agent仕様ファイル（`.claude/agents/specs/`）で、各Agentの役割・権限・エスカレーション条件を定義します。
