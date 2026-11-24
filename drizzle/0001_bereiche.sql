-- Startbereiche der Diplomatie
INSERT INTO "bereich" ("name", "farbe", "reihenfolge") VALUES
  ('Innendienst', '#2f6b3a', 1),
  ('Botschafter', '#3b5f8a', 2),
  ('Flaggen & Bastion', '#b5502a', 3),
  ('Schutzdivision', '#6b4c8a', 4),
  ('Übergreifend', '#7a6a4f', 5)
ON CONFLICT ("name") DO NOTHING;
