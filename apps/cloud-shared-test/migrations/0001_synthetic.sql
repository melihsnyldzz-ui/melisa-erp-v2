-- Dedicated synthetic preview schema only. Runtime inserts its synthetic seed.
CREATE TABLE synthetic_state (id TEXT PRIMARY KEY CHECK(id='synthetic'),marker TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>=0),data TEXT NOT NULL);
CREATE TABLE synthetic_sessions (id TEXT PRIMARY KEY,value TEXT NOT NULL,expiresAt INTEGER NOT NULL);
