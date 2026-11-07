// Fixed, source-only V6 guard fragment. A caller must add the existing exact
// target/physical-connection identity checks and its own SELECT 1 AS ok.
// SQL Server metadata rendering and effective rights remain unverified.
import {DESKTOP_GOODS_V6_SCHEMA_GUARD_SQL,DESKTOP_GOODS_V6_PERMISSION_GUARD_SQL} from './desktopGoodsV6Policy.mjs';
export function getDesktopMasterV6GuardSql(){return DESKTOP_GOODS_V6_PERMISSION_GUARD_SQL+'\n'+DESKTOP_GOODS_V6_SCHEMA_GUARD_SQL;}
