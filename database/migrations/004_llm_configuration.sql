-- Migration 004: LLM Configuration System
-- Purpose: Enable per-user and per-character LLM preferences with global defaults
-- Date: 2025-10-07

-- Add LLM preferences to users table (user-level defaults)
ALTER TABLE users 
ADD COLUMN llm_preferences TEXT DEFAULT '{}';

-- Add LLM preferences to personalities table (character-level overrides)
ALTER TABLE personalities 
ADD COLUMN llm_preferences TEXT DEFAULT '{}';

-- Add global LLM configuration to configuration table
INSERT INTO configuration (key, value, type, description, category, is_user_configurable) VALUES
  ('llm_server_type', 'lmstudio', 'string', 'LLM server type (lmstudio, ollama, openai)', 'llm', 1),
  ('llm_server_endpoint', 'http://localhost:1234/v1', 'string', 'LLM server API endpoint', 'llm', 1),
  ('llm_server_api_key', '', 'string', 'API key for paid services', 'llm', 1),
  
  ('llm_conversational_model', 'llama-3.1-8b-instruct', 'string', 'Default conversational model (LLM1)', 'llm', 1),
  ('llm_conversational_temperature', '0.7', 'number', 'Default conversational temperature', 'llm', 1),
  ('llm_conversational_max_tokens', '2000', 'number', 'Default conversational max tokens', 'llm', 1),
  
  ('llm_analytical_model', 'qwen2.5-7b-instruct', 'string', 'Default analytical model (LLM2)', 'llm', 1),
  ('llm_analytical_temperature', '0.1', 'number', 'Default analytical temperature', 'llm', 1),
  ('llm_analytical_max_tokens', '4000', 'number', 'Default analytical max tokens', 'llm', 1);

-- Example JSON structure for llm_preferences:
-- User table llm_preferences:
-- {
--   "conversational": {
--     "model": "llama-3.1-8b-instruct",
--     "temperature": 0.7,
--     "max_tokens": 2000
--   },
--   "analytical": {
--     "model": "qwen2.5-7b-instruct",
--     "temperature": 0.1,
--     "max_tokens": 4000
--   }
-- }

-- Personality table llm_preferences (only conversational override):
-- {
--   "conversational": {
--     "model": "mistral-7b-instruct",
--     "temperature": 0.8,
--     "max_tokens": 1500
--   }
-- }




