// Frozen opening target constants. No database driver, connection, filesystem or CLI.
export const RUN='VEGA-OPENING-TEST-20261004-06';
export const EXPECTED=Object.freeze({run:RUN,sourceHash:'36971dab7296dd171ee0084c185f833b47b96d6a47fe57c8486a2b81d78ef400',planHash:'18639c27f276f4263d5e9a6b5037753c78f2c3d341a053055db7cb7b00da2f0a',products:16622,prices:63774});
export const targetGuard="IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'MELISA_ERP_SIRKET_TEST_20260929_01' OR CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) COLLATE Latin1_General_100_BIN2<>N'Semih\\MELISADEV' THROW 51075,'WRONG_TEST_TARGET',1;";
