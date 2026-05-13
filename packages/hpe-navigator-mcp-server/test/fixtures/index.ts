export const MOCK_SERIAL = 'CZ2D3J050T'
export const MOCK_DSC_SERIAL = '3TKFTAPMJ4XZ23G3'

export const findResponse = {
  data: [
    {
      matching_serial: MOCK_SERIAL,
      serial: MOCK_SERIAL,
      product: 'arcus',
      model: 'HPE Alletra Storage MP B10100',
      customer: 'ALVES RIBEIRO, S.A.',
      status: 'OK',
      component: null,
    },
  ],
  total: 1,
}

export const relatedResponse = {
  data: {
    solution: 'PCBE',
    related_products: [
      { serial: MOCK_DSC_SERIAL, category: 'dsc', product: 'dsc' },
      { serial: MOCK_SERIAL, category: 'storage', product: 'arcus' },
    ],
  },
}

export const sfdcAssetResponse = {
  data: {
    asset_id: '02iHr00000EFkhuIAD',
    serial: MOCK_SERIAL,
    status: 'shipped',
    install_date: '2024-11-13T00:00:00+0000',
    ship_date: '2024-10-28T00:00:00+0000',
    product: 'arcus',
    product_family: 'Alletra Storage MP',
    product_description: 'HPE Alletra Storage MP B10100 Base Configuration',
    product_code: 'S0B84A',
    sla: 'Premium 4 Hour Onsite',
    hpe_sla: 'Tech Care Essential',
    support_end_date: '2030-11-13T00:00:00+0000',
    support_term_remaining_days: 1636.0,
    is_escalated: false,
    account: { name: 'ALVES RIBEIRO, S.A.', country: 'Portugal' },
    contact: { email: 'it@alvesribeiro.pt', name: 'PEdro Ponte' },
    open_cases: [
      {
        case_number: '07788525',
        subject: 'Array disk degraded',
        status: 'update needed',
        priority: 'P3',
        severity: 'SEV3',
        created_date: '2026-04-01T12:00:00+0000',
        escalation: { first_eng_esc_jira: null, max_eng_esc_pri: null },
      },
    ],
    closed_cases: [],
    escalations: [
      {
        case_number: '07788525',
        jira_id: 'ESC-17193',
        priority: 'P1',
        jira_link: 'https://jira.hpe.com/browse/ESC-17193',
        targets: ['storage-team'],
      },
    ],
  },
}

export const feedResponse = {
  data: [
    {
      category: 'Status Check',
      severity: 'critical' as const,
      message: 'Security: Remote root access is enabled on the array',
    },
    {
      category: 'Status Check',
      severity: 'warning' as const,
      message: 'File: Behavior altering sysvars.init exists',
    },
  ],
}

export const overviewResponse = {
  data: {
    latest_heartbeat_ts: '2026-05-13T11:28:38+0100',
    latest_heartbeat_id: 42567,
    rda_status: 'NORMAL',
    display_name: 'System gar-storage-alletra',
    version: { os: '10.5.55.1', upgrade_tool: '83 (251110)' },
    system_model: 'HPE Alletra Storage MP',
    node_count: 2,
    pd_count: 8,
    cage_count: 1,
    node_issue: false,
    pd_issue: false,
    ps_issue: false,
    env_issue: false,
    maintenance_mode: false,
    space: {
      total: 18882052.0,
      free: 13579457.0,
      raw_space_capacity_percent: 10.19,
    },
  },
}

export const heartbeatResponse = {
  data: {
    id: 42567,
    serial: MOCK_SERIAL,
    collection_time: '2026-05-13T11:28:38+0100',
    rda_status: 'NORMAL',
    network: { management_ip: '10.0.1.100', data_ips: ['10.0.2.100', '10.0.2.101'] },
    capacity: { total_tb: 18.0, used_tb: 5.3, free_tb: 12.7 },
  },
}

export const filetypesResponse = {
  data: [
    { filetype: 'config', indexed: false, single: true },
    { filetype: 'insplore', indexed: false, single: false },
    { filetype: 'heartbeat', indexed: false, single: true },
    { filetype: 'dailylog', indexed: false, single: false },
  ],
}

export const bundlesResponse = {
  data: [
    {
      filedatetime: '2026-05-09T08:30:10+0000',
      scalitydatetime: '2026-05-09T08:30:10+0000',
      type: 'config',
      path: 'HPE.ARCUS/CZ2D3J050T/config/config.260509.083010.7790',
      bucket: 'stats-2026-05',
      size: 1310414,
      metadata_hash: 'abc123',
    },
  ],
}

export const dashboardsResponse = [
  {
    id: 59,
    uid: 'arcus-heartbeat-activity',
    title: 'Heartbeat Activity',
    url: '/d/arcus-heartbeat-activity/heartbeat-activity',
    tags: ['arcus', 'heartbeats'],
    folderTitle: 'arcus',
    folderUrl: '/dashboards/f/arcus',
  },
  {
    id: 26,
    uid: 'arcus-system-capacity',
    title: 'System Capacity',
    url: '/d/arcus-system-capacity/system-capacity',
    tags: ['arcus', 'stats'],
    folderTitle: 'arcus',
    folderUrl: '/dashboards/f/arcus',
  },
]

export function createMockJwt(expiresInSeconds = 86400): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user@hpe.com',
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      iat: Math.floor(Date.now() / 1000),
    }),
  ).toString('base64url')
  const signature = Buffer.from('mock-signature').toString('base64url')
  return `${header}.${payload}.${signature}`
}
