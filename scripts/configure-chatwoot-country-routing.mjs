import { execFileSync } from 'node:child_process';

const chatwootUrl = process.env.CHATWOOT_URL || 'http://127.0.0.1:3100';
const accountId = Number(process.env.CHATWOOT_ACCOUNT_ID || 2);
const inboxId = Number(process.env.CHATWOOT_INBOX_ID || 1);
const adminUserId = Number(process.env.CHATWOOT_ADMIN_USER_ID || 2);

const accessToken = execFileSync(
  'docker',
  [
    'exec',
    'melisa-chatwoot-postgres-1',
    'psql',
    '-U',
    'postgres',
    '-d',
    'chatwoot',
    '-Atc',
    `select token from access_tokens where owner_type='User' and owner_id=${adminUserId} order by id desc limit 1;`,
  ],
  { encoding: 'utf8' },
).trim();

if (!accessToken) {
  throw new Error('Chatwoot administrator access token could not be found.');
}

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${chatwootUrl.replace(/\/$/, '')}${path}`, {
    method,
    headers: {
      api_access_token: accessToken,
      ...(body ? { 'content-type': 'application/json; charset=utf-8' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${path} failed with ${response.status}: ${text}`);
  }
  return data;
}

const routes = [
  { prefix: '+90', team: 'Türkiye 🇹🇷' },
  { prefix: '+49', team: 'Almanya 🇩🇪' },
  { prefix: '+33', team: 'Fransa 🇫🇷' },
  { prefix: '+31', team: 'Hollanda 🇳🇱' },
  { prefix: '+32', team: 'Belçika 🇧🇪' },
  { prefix: '+44', team: 'İngiltere 🇬🇧' },
  { prefix: '+971', team: 'BAE 🇦🇪' },
  { prefix: '+966', team: 'Suudi Arabistan 🇸🇦' },
  { prefix: '+964', team: 'Irak 🇮🇶' },
  { prefix: '+1', team: 'ABD / Kanada 🌎' },
];
const groupTeamName = 'Gruplar 🌐';

const teamResponse = await api(`/api/v1/accounts/${accountId}/teams`);
let teams = Array.isArray(teamResponse) ? teamResponse : teamResponse.payload || [];
let automations = (await api(`/api/v1/accounts/${accountId}/automation_rules`)).payload || [];
const teamByRoute = new Map();

function ruleForPrefix(prefix) {
  return automations.find(rule =>
    rule.event_name === 'conversation_created' &&
    rule.conditions?.some(condition =>
      condition.attribute_key === 'phone_number' &&
      condition.filter_operator === 'starts_with' &&
      condition.values?.includes(prefix),
    ),
  );
}

async function ensureTeam(name, existingTeam) {
  const normalizedName = name.toLowerCase().normalize('NFC');
  let team = existingTeam || teams.find(item => item.name === normalizedName);

  if (!team) {
    team = await api(`/api/v1/accounts/${accountId}/teams`, {
      method: 'POST',
      body: {
        team: {
          name,
          description: 'WhatsApp ülke koduna göre otomatik yönlendirme ekibi.',
          allow_auto_assign: false,
        },
      },
    });
    teams.push(team);
    process.stdout.write(`Team created: ${team.name}\n`);
  } else if (team.name !== normalizedName) {
    team = await api(`/api/v1/accounts/${accountId}/teams/${team.id}`, {
      method: 'PATCH',
      body: {
        team: {
          name,
          description: 'WhatsApp ülke koduna göre otomatik yönlendirme ekibi.',
          allow_auto_assign: false,
        },
      },
    });
    teams = teams.map(item => (item.id === team.id ? team : item));
    process.stdout.write(`Team name repaired: ${team.name}\n`);
  }

  const memberResponse = await api(`/api/v1/accounts/${accountId}/teams/${team.id}/team_members`);
  const members = Array.isArray(memberResponse) ? memberResponse : memberResponse.payload || [];
  if (!members.some(member => Number(member.id) === adminUserId)) {
    await api(`/api/v1/accounts/${accountId}/teams/${team.id}/team_members`, {
      method: 'POST',
      body: { user_ids: [adminUserId] },
    });
    process.stdout.write(`Administrator added to team: ${team.name}\n`);
  }

  return team;
}

for (const route of routes) {
  const existingRule = ruleForPrefix(route.prefix);
  const assignedTeamId = existingRule?.actions
    ?.find(action => action.action_name === 'assign_team')
    ?.action_params?.[0];
  const existingTeam = teams.find(team => Number(team.id) === Number(assignedTeamId));
  const team = await ensureTeam(route.team, existingTeam);
  teamByRoute.set(route.prefix, team);

  const phoneConditions = [
    {
      attribute_key: 'phone_number',
      filter_operator: 'starts_with',
      values: [route.prefix],
      query_operator: route.prefix === '+1' ? 'AND' : null,
    },
  ];
  if (route.prefix === '+1') {
    phoneConditions.push({
      attribute_key: 'phone_number',
      filter_operator: 'not_equal_to',
      values: ['+123456'],
      query_operator: null,
    });
  }

  const ruleBody = {
    name: `Ülke yönlendirme - ${route.team}`,
    description: `Melisa WhatsApp Satış görüşmelerinde ${route.prefix} ile başlayan numaraları ${route.team} ekibine yönlendirir.`,
    event_name: 'conversation_created',
    active: true,
    conditions: [
      {
        attribute_key: 'inbox_id',
        filter_operator: 'equal_to',
        values: [inboxId],
        query_operator: 'AND',
      },
      ...phoneConditions,
    ],
    actions: [{ action_name: 'assign_team', action_params: [Number(team.id)] }],
  };

  if (existingRule) {
    await api(`/api/v1/accounts/${accountId}/automation_rules/${existingRule.id}`, {
      method: 'PATCH',
      body: ruleBody,
    });
    process.stdout.write(`Automation repaired: ${ruleBody.name}\n`);
  } else {
    const createdRule = await api(`/api/v1/accounts/${accountId}/automation_rules`, {
      method: 'POST',
      body: ruleBody,
    });
    automations.push(createdRule.payload || createdRule);
    process.stdout.write(`Automation created: ${ruleBody.name}\n`);
  }
}

const existingGroupTeam =
  teams.find(team => team.name === groupTeamName.toLowerCase().normalize('NFC')) ||
  teams.find(team => team.name.toLowerCase().startsWith('gruplar'));
const groupTeam = await ensureTeam(groupTeamName, existingGroupTeam);

const conversationResponse = await api(`/api/v1/accounts/${accountId}/conversations?status=all`);
const conversations = conversationResponse.data?.payload || [];

for (const conversation of conversations) {
  if (Number(conversation.inbox_id) !== inboxId) continue;

  const sender = conversation.meta?.sender || {};
  const phone = sender.phone_number || '';
  const isGroup = sender.identifier?.endsWith('@g.us') || sender.name?.includes('(GROUP)');
  const isEvolutionBot = phone === '+123456';

  if (isEvolutionBot) {
    const northAmericaTeam = teamByRoute.get('+1');
    if (Number(conversation.meta?.team?.id) === Number(northAmericaTeam?.id)) {
      await api(`/api/v1/accounts/${accountId}/conversations/${conversation.id}/assignments`, {
        method: 'POST',
        body: { team_id: null },
      });
      process.stdout.write(`Evolution system conversation ${conversation.id} removed from country routing.\n`);
    }
    continue;
  }

  const matchingRoute = routes.find(route => phone.startsWith(route.prefix));
  const targetTeam = isGroup ? groupTeam : matchingRoute && teamByRoute.get(matchingRoute.prefix);

  if (!targetTeam || Number(conversation.meta?.team?.id) === Number(targetTeam.id)) continue;

  await api(`/api/v1/accounts/${accountId}/conversations/${conversation.id}/assignments`, {
    method: 'POST',
    body: { team_id: Number(targetTeam.id) },
  });
  process.stdout.write(`Conversation ${conversation.id} routed to: ${targetTeam.name}\n`);
}

process.stdout.write(`Country routing completed: ${routes.length} country teams and one group team.\n`);
