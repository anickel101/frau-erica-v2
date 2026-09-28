-- 002 (seed): the 23 collections, named.
--
-- Names, kinds and blurbs drafted from each series' own chapter titles
-- and its first chapter's summary -- not invented. Where a chapter
-- already carried a real title for the whole work ("The Chicago
-- Memoirs", "Winke fuer Auswanderer", "My Life and Its Times"), that is
-- the name used. Where a series is a person collection with no stated
-- title, the person's name is the name.
--
-- Several blurbs are condensed from the first chapter's own summary,
-- which in those series was already written as a description of the
-- whole work rather than of that chapter.
--
-- Blurbs carry no editorial notes. An early draft put "NEEDS REVIEW"
-- inside them and it rendered straight onto the collection cards, which
-- is what a field the website prints will always do. The list of rows
-- needing the Archivist's eye lives in the pull request instead.

INSERT INTO Series (series_key, slug, name, kind, blurb, sort_key) VALUES

-- ---- works: one work, several chapters, read in order ----

('Chicago', 'chicago-memoirs', 'The Chicago Memoirs', 'work',
 'Joel Nickel''s account of the years in Chicago, told a year at a time from 1967.',
 NULL),

('NanaLifeTimes', 'my-life-and-its-times', 'My Life and Its Times', 'work',
 'Mary Allison (Molly) Bigelow McMillan had a lot to distill into a memoir: daughter of a long-established Twin Cities family, physics graduate of Vassar, war-time bride, civic leader, and among the first ordained Presbyterian women in Minnesota.',
 NULL),

('CarlDeHaas', 'winke-fuer-auswanderer', 'Winke für Auswanderer', 'work',
 'Carl de Haas arrived on the Wisconsin frontier in 1847. His booklet of advice for people considering emigration was widely available in Germany and went through at least two printings.',
 NULL),

('FritzReise', 'fritz-muellers-journal', 'Fritz Mueller''s Journal of the Voyage to America', 'work',
 'Fritz Mueller kept a journal of the 1865 crossing and the journey inland. The archive holds both his German and the English translation made by his great-grandson Herbert, set side by side.',
 NULL),

('LudwigKnief', 'ludwig-kniefs-lebenslauf', 'Ludwig Knief''s Lebenslauf', 'work',
 'Written from memory in August 1902 and addressed to his children: a farm childhood near Bremen, the California gold rush, and a life in the ministry in America. German and English side by side.',
 NULL),

('AlidaBigelow', 'alida-bigelows-memories', 'Alida Wood Bigelow: Memories', 'work',
 'Written at her daughter Emma''s insistence — "It seems to me a foolish undertaking," Alida begins, "as every scrap of paper or records that might help went up in smoke long ago."',
 NULL),

('WilhelmMueller', 'wilhelm-and-frau-erica', 'Wilhelm and Frau Erica', 'work',
 'Wilhelm Mueller and Adelheid, the Frau Erica this archive is named for: Kendallville, then careers in Chicago.',
 NULL),

('JimNickel', 'jim-nickel-three-cities', 'Jim Nickel: Three Cities', 'work',
 'Oak Park, Brentwood, New York — a life told through the places it was lived in.',
 NULL),

-- ---- annual: the same thing once a year ----

('MarkAlliChristmas', 'christmas-letters', 'Mark and Alli''s Christmas Letters', 'annual',
 'Annual Christmas letters get a mixed reception: tossed unread, browsed lightly, responded to. In the aggregate, though, they have some historical value — some bits of information about who''s doing what. So here''s the archive.',
 NULL),

-- ---- person: everything about one person, by different hands ----

('GerhardMueller', 'gerhard-mueller', 'Gerhard Mueller', 'person',
 'The pastor of Height of Land, remembered in a tournament report, an estate record, and a road trip taken to find the parishes he served.',
 NULL),

('FrauErica', 'frau-erica', 'Adelheid Rickmeyer, Frau Erica', 'person',
 'The Frau Erica of the archive''s name, and her cookbook.',
 NULL),

('Janzow', 'the-bethlehem-congregation', 'The Bethlehem Congregation Case', 'person',
 'A minister sued his congregation in St. Louis, and the proceedings were published in German.',
 NULL),

('FredKnief', 'fred-knief', 'Fred Knief', 'person',
 'A brother-in-law''s account of a Mueller wedding, and the story of his own.',
 NULL),

('JoelNickel', 'joel-nickel', 'Joel Nickel', 'person',
 'Forty years of ministry, and a second life in art.',
 NULL),

('KevinMcKibbin', 'kevin-mckibbin', 'Kevin McKibbin', 'person',
 'Park ranger. Remembered in his obituary and in an account of the work.',
 NULL),

('TanteFieks', 'tante-fieks', 'Tante Fieks', 'person',
 'Sofie Mueller — Tante Fieks — looking back on bright and dark days.',
 NULL),

('OpaObit', 'ehc-mueller', 'The Rev. E.H.C. Mueller', 'person',
 'Two obituaries of the same man, one in English and one in German.',
 NULL),

('Waldschmidt', 'the-waldschmidts', 'The Waldschmidts', 'person',
 'Anna''s history, and Henry''s.',
 NULL),

('Hib', 'hc-nickel', 'H.C. Nickel', 'person',
 'Stock seller, teacher, and a newspaper column on money and happiness.',
 NULL),

-- ---- not yet published: seeded so they are named when they are ----

('KurtMueller', 'kurt-mueller', 'Kurt Mueller', 'person',
 NULL,
 NULL),

('KamKwaiChan', 'kam-kwai-chan', 'Kam Kwai Chan', 'person',
 'Five poems, and a fighting determination to survive.',
 NULL),

('ErnstHelen', 'ernst-and-helen', 'Ernst and Helen Mueller', 'person',
 'The Muellers of Freedom Township, and life in the bakerhouse, 1911-1948.',
 NULL),

('DodoKnief', 'dodo-knief', 'Dodo Knief', 'person',
 'Live wire, columnist, woman of mystery.',
 NULL);
