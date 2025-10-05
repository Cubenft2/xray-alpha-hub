-- Add admin role for existing user
INSERT INTO public.user_roles (user_id, role)
VALUES ('656d3a12-f2af-401f-af5c-b287883148eb', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;