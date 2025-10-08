-- Migration 006: Add Context Window Configuration
-- Add context window configuration to LLM settings

INSERT INTO configuration (key, value, type, description, category, is_user_configurable) VALUES
('llm_conversational_context_window', '30', 'number', 'Number of recent messages to include in context', 'llm', 1),
('llm_analytical_context_window', '30', 'number', 'Number of recent messages for analytical tasks', 'llm', 1),
('memory_significance_threshold', '7', 'number', 'Minimum score (1-10) for memory to be searchable', 'llm', 1);
