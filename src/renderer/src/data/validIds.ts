export interface ValidIdItem {
  id: string
  name: string
  description?: string
}

export interface ValidIdGroup {
  group: string
  items: ValidIdItem[]
}

export interface ValidId extends ValidIdItem {
  group: string
}

export const VALID_ID_GROUPS: ValidIdGroup[] = [
  {
    group: 'Primary Valid IDs',
    items: [
      {
        id: 'philid',
        name: 'Philippine Identification (PhilID / ePhilID)',
        description: 'PSA · top-tier national ID'
      },
      {
        id: 'passport',
        name: 'Philippine Passport',
        description: 'DFA · for international travel'
      },
      {
        id: 'drivers_license',
        name: "Driver's License",
        description: 'LTO'
      },
      {
        id: 'umid',
        name: 'UMID (Unified Multi-Purpose ID)',
        description: 'SSS / GSIS'
      },
      {
        id: 'prc',
        name: 'PRC ID',
        description: 'For licensed professionals'
      },
      {
        id: 'postal',
        name: 'Postal ID',
        description: 'PHLPost · digitized version'
      },
      {
        id: 'voters',
        name: "Voter's ID / Voter's Certificate",
        description: 'COMELEC'
      },
      {
        id: 'nbi',
        name: 'NBI Clearance',
        description: 'For employment & government applications'
      }
    ]
  },
  {
    group: 'Secondary Valid IDs',
    items: [
      { id: 'tin', name: 'TIN ID', description: 'BIR · Taxpayer Identification Number' },
      { id: 'philhealth', name: 'PhilHealth ID', description: 'Digitized version preferred' },
      { id: 'senior', name: 'Senior Citizen ID', description: 'OSCA' },
      { id: 'pwd', name: 'PWD ID', description: 'For Persons with Disabilities' },
      { id: 'solo_parent', name: 'Solo Parent ID', description: 'DSWD / LGU' },
      {
        id: 'brgy_cert',
        name: 'Barangay Certification',
        description: 'Must include photo and dry seal'
      },
      { id: 'police', name: 'Police Clearance', description: 'PNP' },
      { id: 'school', name: 'School ID', description: 'Current students' },
      { id: 'company', name: 'Company ID', description: 'Registered private entities' }
    ]
  },
  {
    group: 'Maritime & Seafarer IDs',
    items: [
      {
        id: 'sid',
        name: "SID (Seafarer's Identity Document)",
        description: 'MARINA · biometric'
      },
      {
        id: 'srb',
        name: "SRB (Seafarer's Record Book)",
        description: "Formerly Seaman's Book (SIRB)"
      },
      {
        id: 'marina_pro',
        name: 'MARINA Professional ID',
        description: 'Maritime officers'
      }
    ]
  },
  {
    group: 'Security & Firearms (PNP-FEO)',
    items: [
      {
        id: 'ltopf',
        name: 'LTOPF (License to Own and Possess Firearms)',
        description: 'Foundational firearm license'
      },
      {
        id: 'firearm_reg',
        name: 'Firearm Registration Card',
        description: 'License for a specific gun'
      },
      {
        id: 'ptcfor',
        name: 'PTCFOR (Permit to Carry Firearm Outside Residence)',
        description: 'Public carry permit'
      }
    ]
  },
  {
    group: 'Other Specialized & Professional IDs',
    items: [
      { id: 'ofw', name: 'OFW ID (e-Card)', description: 'DMW (formerly POEA / OWWA)' },
      {
        id: 'ibp',
        name: 'IBP ID',
        description: 'Integrated Bar of the Philippines · for lawyers'
      },
      { id: 'afp_pnp', name: 'AFP / PNP ID', description: 'Active military / police personnel' },
      {
        id: 'acr',
        name: 'ACR I-Card (Alien Certificate of Registration)',
        description: 'For foreign residents'
      },
      {
        id: 'bfar',
        name: "BFAR Fishworker's License",
        description: 'Bureau of Fisheries and Aquatic Resources'
      },
      {
        id: 'philracom',
        name: 'PHILRACOM License',
        description: 'Philippine Racing Commission'
      }
    ]
  }
]

export const ALL_VALID_IDS: ValidId[] = VALID_ID_GROUPS.flatMap((g) =>
  g.items.map((item) => ({ ...item, group: g.group }))
)
