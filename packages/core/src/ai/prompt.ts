import type { DatabaseSchema, Dialect } from '../types.js';

export interface TextToSqlPromptOptions {
  dialect: Dialect;
  userPrompt: string;
  schema: DatabaseSchema;
  selectedTable?: string;
}

/**
 * Builds a privacy-preserving, schema-only context prompt for natural language to SQL generation.
 * STRICT PRIVACY GUARANTEE: Never transmits table row values, only schema metadata (tables, columns, types, keys).
 */
export function buildSchemaOnlyAiPrompt(options: TextToSqlPromptOptions): {
  systemPrompt: string;
  userPrompt: string;
  schemaSummary: string;
} {
  const { dialect, userPrompt, schema, selectedTable } = options;

  // Build clean DDL schema summary without any row data
  const tableDescriptions = schema.tables.map((t) => {
    const colDefs = t.columns.map((c) => {
      let desc = `  - ${c.name} (${c.type})`;
      if (c.primaryKey) desc += ' [PRIMARY KEY]';
      if (!c.nullable) desc += ' [NOT NULL]';
      return desc;
    });

    const fkDefs = (t.foreignKeys || []).map(
      (fk) => `  * FOREIGN KEY (${fk.column}) -> ${fk.referencedTable}(${fk.referencedColumn})`
    );

    return `Table "${t.name}":\n${colDefs.join('\n')}${fkDefs.length > 0 ? `\nRelationships:\n${fkDefs.join('\n')}` : ''}`;
  });

  const schemaSummary = tableDescriptions.join('\n\n');

  const systemPrompt = `You are an expert SQL engineer. Generate a single, syntactically correct SQL query for ${dialect.toUpperCase()} that answers the user's natural language request.
Rules:
1. ONLY use tables and columns defined in the provided schema.
2. Return ONLY the executable SQL query wrapped inside a markdown \`\`\`sql code block.
3. Do NOT include markdown explanations or commentary outside the query.
4. Keep the query performant and follow best practices for ${dialect}.`;

  const formattedUserPrompt = `Database Dialect: ${dialect.toUpperCase()}
${selectedTable ? `Active Table Context: ${selectedTable}\n` : ''}
Database Schema:
${schemaSummary}

User Request: "${userPrompt}"

Write the SQL query:`;

  return {
    systemPrompt,
    userPrompt: formattedUserPrompt,
    schemaSummary,
  };
}
