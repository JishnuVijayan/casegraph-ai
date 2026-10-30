// Core services default ON in the app; tests run offline unless a test opts in explicitly.
for (const name of ['TEXTRACT_ENABLED', 'BEDROCK_ENABLED', 'TIGERGRAPH_ENABLED']) process.env[name] ??= 'false';
