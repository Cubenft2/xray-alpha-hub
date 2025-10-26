-- Remove all truncated quotes (those ending with ellipsis)
DELETE FROM quote_library 
WHERE quote_text LIKE '%…';