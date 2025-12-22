
-- Flag VERIFY tokens (may be delisted from CoinGecko markets)
INSERT INTO token_flags (symbol, category, notes, flagged_by) VALUES
('1INCH', 'review', 'CG API not returning - verify if delisted', '656d3a12-f2af-401f-af5c-b287883148eb'),
('BOBA', 'review', 'CG API not returning - verify if delisted', '656d3a12-f2af-401f-af5c-b287883148eb'),
('BONE', 'review', 'CG API not returning - verify if delisted', '656d3a12-f2af-401f-af5c-b287883148eb'),
('CLV', 'review', 'CG API not returning - verify if delisted', '656d3a12-f2af-401f-af5c-b287883148eb'),
('CVC', 'review', 'CG API not returning - verify if delisted', '656d3a12-f2af-401f-af5c-b287883148eb'),
('DAR', 'review', 'CG API not returning - verify if delisted', '656d3a12-f2af-401f-af5c-b287883148eb'),
('ERN', 'review', 'CG API not returning - verify if delisted', '656d3a12-f2af-401f-af5c-b287883148eb'),
('FARM', 'review', 'CG API not returning - verify if delisted', '656d3a12-f2af-401f-af5c-b287883148eb'),
('GLM', 'review', 'CG API not returning - verify if delisted', '656d3a12-f2af-401f-af5c-b287883148eb'),
('OMG', 'review', 'CG API not returning - verify if delisted', '656d3a12-f2af-401f-af5c-b287883148eb'),
('POWR', 'review', 'CG API not returning - verify if delisted', '656d3a12-f2af-401f-af5c-b287883148eb')
ON CONFLICT DO NOTHING;

-- Flag MANUAL/RESEARCH tokens needing manual investigation
INSERT INTO token_flags (symbol, category, notes, flagged_by) VALUES
('ACE', 'needs_work', 'CG API not returning - may need different coingecko_id', '656d3a12-f2af-401f-af5c-b287883148eb'),
('AMP', 'needs_work', 'CG API not returning - may need different coingecko_id', '656d3a12-f2af-401f-af5c-b287883148eb'),
('API3', 'needs_work', 'CG API not returning - may need different coingecko_id', '656d3a12-f2af-401f-af5c-b287883148eb'),
('ARPA', 'needs_work', 'CG API not returning - may need different coingecko_id', '656d3a12-f2af-401f-af5c-b287883148eb'),
('ASM', 'needs_work', 'CG API not returning - may need different coingecko_id', '656d3a12-f2af-401f-af5c-b287883148eb'),
('AST', 'needs_work', 'CG API not returning - may need different coingecko_id', '656d3a12-f2af-401f-af5c-b287883148eb'),
('AVA', 'needs_work', 'CG API not returning - may need different coingecko_id', '656d3a12-f2af-401f-af5c-b287883148eb'),
('BAL', 'needs_work', 'CG API not returning - may need different coingecko_id', '656d3a12-f2af-401f-af5c-b287883148eb'),
('BAND', 'needs_work', 'CG API not returning - may need different coingecko_id', '656d3a12-f2af-401f-af5c-b287883148eb'),
('BICO', 'needs_work', 'CG API not returning - may need different coingecko_id', '656d3a12-f2af-401f-af5c-b287883148eb'),
('CTSI', 'needs_work', 'CG API not returning - may need different coingecko_id', '656d3a12-f2af-401f-af5c-b287883148eb'),
('DIA', 'needs_work', 'CG API not returning - may need different coingecko_id', '656d3a12-f2af-401f-af5c-b287883148eb'),
('FOX', 'needs_work', 'CG API not returning - may need different coingecko_id', '656d3a12-f2af-401f-af5c-b287883148eb'),
('GAL', 'needs_work', 'CG API not returning - may need different coingecko_id', '656d3a12-f2af-401f-af5c-b287883148eb'),
('GNO', 'needs_work', 'CG API not returning - may need different coingecko_id', '656d3a12-f2af-401f-af5c-b287883148eb'),
('LCX', 'needs_work', 'CG API not returning - may need different coingecko_id', '656d3a12-f2af-401f-af5c-b287883148eb'),
('MATH', 'needs_work', 'CG API not returning - may need different coingecko_id', '656d3a12-f2af-401f-af5c-b287883148eb'),
('MEDIA', 'needs_work', 'CG API not returning - may need different coingecko_id', '656d3a12-f2af-401f-af5c-b287883148eb')
ON CONFLICT DO NOTHING;
