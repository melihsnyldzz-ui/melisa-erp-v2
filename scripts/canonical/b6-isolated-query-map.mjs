import { createHash } from 'node:crypto';

// Frozen ScriptDom 161 AST positions for exactly two final reader SELECTs.
// Offsets/lengths are UTF-16 code units, before any newline normalization.
// This module only extracts source text. It has no SQL, filesystem or process executor.
export const B6_ISOLATED_QUERY_ARTIFACT = Object.freeze({
  revision: 'F05B63189AFC7A5BAF6E5686631CC3B793ECF73F94C472DB32747138EBAFC7C8',
  sha256: '07D62A7AF89F80BE60C194CA0FA15FF39823A0F44E77EB6D74F137245EA70FC0',
  classification: 'DIAGNOSTIC_PARTIAL_NOT_REHEARSAL',
});

function freezeTree(value) {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freezeTree(item);
    Object.freeze(value);
  }
  return value;
}

export const B6_ISOLATED_SELECTED_QUERIES = freezeTree([
  {
    "module": "dbo.usp_b6_reader_50e615ffdb8a8ec3_v1",
    "definitionHash": "7FC24FBEE871082A799C98F4C202BD91C3731584AA368FF375D261855317F764",
    "statement": {
      "type": "SelectStatement",
      "offset": 52738,
      "length": 9806,
      "line": 117,
      "column": 2,
      "endLine": 125,
      "sha256Utf16LE": "08062C1F7C36FF5DBE441978BE75C369053FEE0B0B105E3751B79D69F45C641F"
    },
    "outerQuery": {
      "type": "QuerySpecification",
      "offset": 52738,
      "length": 9805,
      "line": 117,
      "column": 2,
      "endLine": 125,
      "sha256Utf16LE": "4B692DF21B2A92E921A641E50BB3A9600997E622CB52660C9A1FED74388C28C9"
    },
    "aggregates": [
      {
        "call": {
          "type": "FunctionCall",
          "offset": 56192,
          "length": 350,
          "line": 117,
          "column": 3456,
          "endLine": 117,
          "sha256Utf16LE": "38E040EFE84EB99AA6372FF10D7FAB27D3DCB74E5C7B59BE66E883C63243C431"
        },
        "query": {
          "type": "QuerySpecification",
          "offset": 56144,
          "length": 549,
          "line": 117,
          "column": 3408,
          "endLine": 117,
          "sha256Utf16LE": "95C5D785AFE62C1DC5C3B028609C5F629C0D3F414C6AFA6C0936A86AD8F4CF60"
        },
        "ordering": "ORDER BY name"
      },
      {
        "call": {
          "type": "FunctionCall",
          "offset": 56738,
          "length": 199,
          "line": 118,
          "column": 24,
          "endLine": 118,
          "sha256Utf16LE": "5FF1E494B4023388969F9B1EC27982BC99DFCCA70B525EB8F399B4577C36C5FC"
        },
        "query": {
          "type": "QuerySpecification",
          "offset": 56731,
          "length": 5790,
          "line": 118,
          "column": 17,
          "endLine": 125,
          "sha256Utf16LE": "2600B85996D24485713EFABFC9C719436492E14F8234F5FE3A82E35F797B4F62"
        },
        "ordering": "ORDER BY p.stock_code,p.id"
      }
    ],
    "selectedReferences": {
      "variables": [
        "@actor_id",
        "@financial",
        "@page",
        "@page_size",
        "@product_id",
        "@read_at"
      ],
      "relations": [
        "#Goal7Products",
        "#StockAliasPairs",
        "#StockMatches",
        "#StockPage",
        "#StockScope",
        "dbo.product_barcodes",
        "dbo.product_images",
        "dbo.product_prices",
        "dbo.products",
        "dbo.test_product_price_current",
        "dbo.test_product_price_units",
        "dbo.test_product_price_versions",
        "erp_migration.goal7_source_version_prices",
        "erp_migration.goal7_source_version_records",
        "erp_migration.operation_quarantine_holds",
        "sys.triggers"
      ]
    },
    "functions": [
      "CONCAT",
      "COUNT",
      "HASHBYTES",
      "JSON_MODIFY",
      "JSON_QUERY",
      "JSON_VALUE",
      "OBJECT_DEFINITION",
      "OBJECT_ID",
      "OBJECTPROPERTY",
      "STRING_AGG"
    ],
    "procedureParameters": [
      {
        "name": "@actor_id",
        "sqlType": "bigint",
        "hasDefault": false,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 56,
          "length": 16,
          "line": 2,
          "column": 2,
          "endLine": 2,
          "sha256Utf16LE": "2FDD7F36A27815B061462621D78C42D9FC35117BFA5C26248CD7B7CFE692044E"
        }
      },
      {
        "name": "@product_id",
        "sqlType": "bigint",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 73,
          "length": 23,
          "line": 2,
          "column": 19,
          "endLine": 2,
          "sha256Utf16LE": "22BB7401D61CE9E1B928F211BCE1A4F5E4925210125888510C30D37B43708503"
        }
      },
      {
        "name": "@search",
        "sqlType": "nvarchar(120)",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 97,
          "length": 25,
          "line": 2,
          "column": 43,
          "endLine": 2,
          "sha256Utf16LE": "C49A268482AE5DFAA4F27099599208CB96525D6D38F2C701878DB38950ABBC35"
        }
      },
      {
        "name": "@barcode",
        "sqlType": "nvarchar(160)",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 123,
          "length": 26,
          "line": 2,
          "column": 69,
          "endLine": 2,
          "sha256Utf16LE": "4AECBA2F3EF8C4D100FBB8945BEBFDA06F2682ADC4BCFB2CD817BABC6BD78EC2"
        }
      },
      {
        "name": "@stock",
        "sqlType": "nvarchar(12)",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 150,
          "length": 26,
          "line": 2,
          "column": 96,
          "endLine": 2,
          "sha256Utf16LE": "DD6FBF51D991125801BC1E611C96E7EB6909B7BE75342A5DE45C47BB07D6C0BF"
        }
      },
      {
        "name": "@status",
        "sqlType": "nvarchar(12)",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 177,
          "length": 27,
          "line": 2,
          "column": 123,
          "endLine": 2,
          "sha256Utf16LE": "FFD8AF7725A444E5E12F5AB97EA29539A6370D04178DDCC9BD8F5D11BD08E472"
        }
      },
      {
        "name": "@page",
        "sqlType": "int",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 205,
          "length": 11,
          "line": 2,
          "column": 151,
          "endLine": 2,
          "sha256Utf16LE": "FB2DE2AC9F46CCA7578D812307C51350FF74D3707756BD98FDEF9A7C1998A784"
        }
      },
      {
        "name": "@page_size",
        "sqlType": "int",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 217,
          "length": 17,
          "line": 2,
          "column": 163,
          "endLine": 2,
          "sha256Utf16LE": "A6245F6F4EBF77F532953F55103A78FF7A11852637A098148A8B078BEC01AD56"
        }
      }
    ],
    "declareStatements": [
      {
        "variables": [
          {
            "name": "@financial",
            "sqlType": "bit"
          },
          {
            "name": "@read_at",
            "sqlType": "varchar(24)"
          }
        ],
        "fragment": {
          "type": "DeclareVariableStatement",
          "offset": 41025,
          "length": 332,
          "line": 86,
          "column": 2,
          "endLine": 86,
          "sha256Utf16LE": "756705FFDC74289DD05582F72900A47C4B004886D1098553A667F2B5A50A2939"
        },
        "references": {
          "variables": [
            "@actor_id"
          ],
          "relations": [
            "dbo.permissions",
            "dbo.users"
          ]
        }
      },
      {
        "variables": [
          {
            "name": "@classification_validation",
            "sqlType": "bit"
          }
        ],
        "fragment": {
          "type": "DeclareVariableStatement",
          "offset": 41359,
          "length": 41,
          "line": 87,
          "column": 2,
          "endLine": 87,
          "sha256Utf16LE": "CF628BDED01BDD6603CBB72B8AFC172478C36E23A9EB2198C1952E724DA9E9A1"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      }
    ],
    "tempContext": [
      {
        "relation": "#StockAliasPairs",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 1087,
          "length": 108,
          "line": 7,
          "column": 2,
          "endLine": 7,
          "sha256Utf16LE": "58EE9E29061576F7D6AF3430EE2F2AD3C4B7713B48DCA5DB88D54DC8E4C8EA11"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      },
      {
        "relation": "#StockAliasProductCounts",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 1440,
          "length": 90,
          "line": 10,
          "column": 1,
          "endLine": 10,
          "sha256Utf16LE": "C35347A36AE09027E8F20F8C64C0B7297DD12BD801865A3F2584F65111C88A87"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      },
      {
        "relation": "#StockAliasSourceCounts",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 1738,
          "length": 93,
          "line": 13,
          "column": 1,
          "endLine": 13,
          "sha256Utf16LE": "09C8D9257B4C42BCAAAE384FAEB64E4A272972E9E2348CDB4EFEDB8A0B35AC96"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      },
      {
        "relation": "#Goal7Products",
        "kind": "SELECT_INTO_TEMP",
        "fragment": {
          "type": "SelectStatement",
          "offset": 43772,
          "length": 147,
          "line": 94,
          "column": 1,
          "endLine": 94,
          "sha256Utf16LE": "C61578EB2966292E9D0C40EF6A1CE3033953329D593CEA1DEFCB905EBB435378"
        },
        "references": {
          "variables": [],
          "relations": [
            "erp_migration.goal7_source_version_products"
          ]
        }
      },
      {
        "relation": "#StockScope",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 46529,
          "length": 84,
          "line": 102,
          "column": 2,
          "endLine": 102,
          "sha256Utf16LE": "8F9FC15337B08B3601BB3A92E726AE93BFDC67647E97601149723BBC43044975"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      },
      {
        "relation": "#StockMatches",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 46969,
          "length": 86,
          "line": 106,
          "column": 2,
          "endLine": 106,
          "sha256Utf16LE": "42DB4E5E34D509A7429CE8745EB1C4C855490250FD8C79C81AAE24F7001BA529"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      },
      {
        "relation": "#StockPage",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 47767,
          "length": 83,
          "line": 108,
          "column": 2,
          "endLine": 108,
          "sha256Utf16LE": "D33E83CCD4143275D7FEB08669F9D5A2B592C745CF5317878BC54CC5A8068071"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      }
    ],
    "moduleExecuteAsOwner": true,
    "selectedProjectionCalls": 0
  },
  {
    "module": "dbo.usp_b6_reader_fccebc6e99370487_v1",
    "definitionHash": "883EA9A388164FA67A2345A418DF42185C4046F53734C5859F477719420C0E90",
    "statement": {
      "type": "SelectStatement",
      "offset": 78207,
      "length": 10163,
      "line": 199,
      "column": 2,
      "endLine": 208,
      "sha256Utf16LE": "93133CB678CB77D5257525B79629DD5618F569840C7B563F8AAEFE2DA8B80675"
    },
    "outerQuery": {
      "type": "QuerySpecification",
      "offset": 78207,
      "length": 10162,
      "line": 199,
      "column": 2,
      "endLine": 208,
      "sha256Utf16LE": "D59667C01882AE417D801844DDE052E06006A345B4C92A32792B0B5652C66A7B"
    },
    "aggregates": [
      {
        "call": {
          "type": "FunctionCall",
          "offset": 81706,
          "length": 350,
          "line": 199,
          "column": 3501,
          "endLine": 199,
          "sha256Utf16LE": "38E040EFE84EB99AA6372FF10D7FAB27D3DCB74E5C7B59BE66E883C63243C431"
        },
        "query": {
          "type": "QuerySpecification",
          "offset": 81658,
          "length": 549,
          "line": 199,
          "column": 3453,
          "endLine": 199,
          "sha256Utf16LE": "95C5D785AFE62C1DC5C3B028609C5F629C0D3F414C6AFA6C0936A86AD8F4CF60"
        },
        "ordering": "ORDER BY name"
      },
      {
        "call": {
          "type": "FunctionCall",
          "offset": 82381,
          "length": 84,
          "line": 200,
          "column": 24,
          "endLine": 200,
          "sha256Utf16LE": "4CC36B0BF28B60F9AD3A2BA689D29D949CD72E77DD47CE6986C7059C6B466B31"
        },
        "query": {
          "type": "QuerySpecification",
          "offset": 82374,
          "length": 5973,
          "line": 200,
          "column": 17,
          "endLine": 208,
          "sha256Utf16LE": "0C07EAE0DC931034379CE1080570962D1187DC9E5B2E7FEFE6DD27F9DF086799"
        },
        "ordering": "ORDER BY o.position"
      }
    ],
    "selectedReferences": {
      "variables": [
        "@actor_id",
        "@page",
        "@page_size",
        "@read_at",
        "@sales"
      ],
      "relations": [
        "#CatalogClassification",
        "#CatalogOrder",
        "#StockAliasPairs",
        "#StockMatches",
        "#StockPage",
        "#StockScope",
        "dbo.product_barcodes",
        "dbo.products",
        "dbo.test_product_price_units",
        "erp_migration.accepted_price_products",
        "erp_migration.goal7_source_version_prices",
        "erp_migration.goal7_source_version_products",
        "erp_migration.goal7_source_version_records",
        "erp_migration.operation_quarantine_holds",
        "sys.triggers"
      ]
    },
    "functions": [
      "CONCAT",
      "COUNT",
      "HASHBYTES",
      "JSON_QUERY",
      "JSON_VALUE",
      "OBJECT_DEFINITION",
      "OBJECT_ID",
      "OBJECTPROPERTY",
      "STRING_AGG"
    ],
    "procedureParameters": [
      {
        "name": "@actor_id",
        "sqlType": "bigint",
        "hasDefault": false,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 56,
          "length": 16,
          "line": 2,
          "column": 2,
          "endLine": 2,
          "sha256Utf16LE": "2FDD7F36A27815B061462621D78C42D9FC35117BFA5C26248CD7B7CFE692044E"
        }
      },
      {
        "name": "@product_id",
        "sqlType": "bigint",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 73,
          "length": 23,
          "line": 2,
          "column": 19,
          "endLine": 2,
          "sha256Utf16LE": "22BB7401D61CE9E1B928F211BCE1A4F5E4925210125888510C30D37B43708503"
        }
      },
      {
        "name": "@search",
        "sqlType": "nvarchar(120)",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 97,
          "length": 25,
          "line": 2,
          "column": 43,
          "endLine": 2,
          "sha256Utf16LE": "C49A268482AE5DFAA4F27099599208CB96525D6D38F2C701878DB38950ABBC35"
        }
      },
      {
        "name": "@barcode",
        "sqlType": "nvarchar(160)",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 123,
          "length": 26,
          "line": 2,
          "column": 69,
          "endLine": 2,
          "sha256Utf16LE": "4AECBA2F3EF8C4D100FBB8945BEBFDA06F2682ADC4BCFB2CD817BABC6BD78EC2"
        }
      },
      {
        "name": "@stock",
        "sqlType": "nvarchar(12)",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 150,
          "length": 26,
          "line": 2,
          "column": 96,
          "endLine": 2,
          "sha256Utf16LE": "DD6FBF51D991125801BC1E611C96E7EB6909B7BE75342A5DE45C47BB07D6C0BF"
        }
      },
      {
        "name": "@status",
        "sqlType": "nvarchar(12)",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 177,
          "length": 27,
          "line": 2,
          "column": 123,
          "endLine": 2,
          "sha256Utf16LE": "FFD8AF7725A444E5E12F5AB97EA29539A6370D04178DDCC9BD8F5D11BD08E472"
        }
      },
      {
        "name": "@page",
        "sqlType": "int",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 205,
          "length": 11,
          "line": 2,
          "column": 151,
          "endLine": 2,
          "sha256Utf16LE": "FB2DE2AC9F46CCA7578D812307C51350FF74D3707756BD98FDEF9A7C1998A784"
        }
      },
      {
        "name": "@page_size",
        "sqlType": "int",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 217,
          "length": 17,
          "line": 2,
          "column": 163,
          "endLine": 2,
          "sha256Utf16LE": "7435D158563D1E47674B453EA62BC3C6E08A0B64157342617C5C2862CC79EAB1"
        }
      },
      {
        "name": "@brand",
        "sqlType": "nvarchar(250)",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 235,
          "length": 24,
          "line": 2,
          "column": 181,
          "endLine": 2,
          "sha256Utf16LE": "73A9A5D93D1BBF724EF487D2C01761613DE1F8A07434A280DA68F3395FE47966"
        }
      },
      {
        "name": "@product_type",
        "sqlType": "nvarchar(250)",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 260,
          "length": 31,
          "line": 2,
          "column": 206,
          "endLine": 2,
          "sha256Utf16LE": "F524C2D143FEC7DF25807F862D438AF63C0FE3F6CB08BF581A953B2827961D9C"
        }
      },
      {
        "name": "@image",
        "sqlType": "nvarchar(12)",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 292,
          "length": 26,
          "line": 2,
          "column": 238,
          "endLine": 2,
          "sha256Utf16LE": "632A96A3C7EFB6895F8944C2A2969D2566CBF9AF7AFF9CB0A71FCE294524A1AB"
        }
      },
      {
        "name": "@sort",
        "sqlType": "nvarchar(12)",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 319,
          "length": 30,
          "line": 2,
          "column": 265,
          "endLine": 2,
          "sha256Utf16LE": "57D987CB7C58068D76441A8E820FC4B342B92190C68CE673D34EC65EC295FCD0"
        }
      },
      {
        "name": "@media_bindings",
        "sqlType": "nvarchar(max)",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 350,
          "length": 35,
          "line": 2,
          "column": 296,
          "endLine": 2,
          "sha256Utf16LE": "517F786843CA87147A905045B4196CC9D5596695AD00D89A0941A75E7FD7A6AD"
        }
      },
      {
        "name": "@candidate_bindings",
        "sqlType": "nvarchar(max)",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 386,
          "length": 39,
          "line": 2,
          "column": 332,
          "endLine": 2,
          "sha256Utf16LE": "F34DDB627F71B97D8A1C08A24D5247205A3DA96E435C28F17670CEC7C775954C"
        }
      },
      {
        "name": "@classification_validation",
        "sqlType": "bit",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 426,
          "length": 32,
          "line": 2,
          "column": 372,
          "endLine": 2,
          "sha256Utf16LE": "F40F7B6ECAAC95FED25D272A551E3B0E07983D9E0C5C54DD911EBD2E01F49906"
        }
      },
      {
        "name": "@classification_bindings",
        "sqlType": "nvarchar(max)",
        "hasDefault": true,
        "fragment": {
          "type": "ProcedureParameter",
          "offset": 459,
          "length": 44,
          "line": 2,
          "column": 405,
          "endLine": 2,
          "sha256Utf16LE": "80EC5966778F8C6ED26FBAAB453EC37E7ACFFAEDF121C96079D1585206D2B521"
        }
      }
    ],
    "declareStatements": [
      {
        "variables": [
          {
            "name": "@financial",
            "sqlType": "bit"
          },
          {
            "name": "@sales",
            "sqlType": "bit"
          },
          {
            "name": "@read_at",
            "sqlType": "varchar(24)"
          }
        ],
        "fragment": {
          "type": "DeclareVariableStatement",
          "offset": 5455,
          "length": 342,
          "line": 14,
          "column": 2,
          "endLine": 14,
          "sha256Utf16LE": "9C2ABF7FD8BCF31EABBEF05EA1F38D6B2CE83667B66FD97818B37AD5DC22C359"
        },
        "references": {
          "variables": [
            "@actor_id"
          ],
          "relations": [
            "dbo.permissions",
            "dbo.users"
          ]
        }
      }
    ],
    "tempContext": [
      {
        "relation": "#StockScope",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 11094,
          "length": 84,
          "line": 28,
          "column": 32,
          "endLine": 28,
          "sha256Utf16LE": "8F9FC15337B08B3601BB3A92E726AE93BFDC67647E97601149723BBC43044975"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      },
      {
        "relation": "#CatalogClassification",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 11866,
          "length": 381,
          "line": 34,
          "column": 1,
          "endLine": 34,
          "sha256Utf16LE": "C7D41270506CEA14A76DAC653241F43BCB719517B6D87AD5DE89777D15184FB1"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      },
      {
        "relation": "#CatalogCandidates",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 16586,
          "length": 105,
          "line": 48,
          "column": 2,
          "endLine": 48,
          "sha256Utf16LE": "B80AE40D594058DC138A2A487BE080FFC7F6E85EB110CFA6F22455571E8AA2B9"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      },
      {
        "relation": "#CatalogMediaBindings",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 17366,
          "length": 172,
          "line": 55,
          "column": 1,
          "endLine": 55,
          "sha256Utf16LE": "37E68DAC27777E5B2635A1A33F8E9130726BE19AB00E1D6E22F3AEBEBF11C25B"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      },
      {
        "relation": "#CatalogMediaAliasTargetSources",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 17991,
          "length": 89,
          "line": 59,
          "column": 2,
          "endLine": 59,
          "sha256Utf16LE": "CBF01CF0906D65ED5F7E009C49703ECD60EFB46C6B18315B35F2968DA1012951"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      },
      {
        "relation": "#CatalogMediaAliasPairs",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 18409,
          "length": 115,
          "line": 61,
          "column": 2,
          "endLine": 61,
          "sha256Utf16LE": "DE8E70921A761E0359F7A37D14A379025E22CC3EE25517D1934263735D345B3B"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      },
      {
        "relation": "#CatalogMediaAliasProductCounts",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 18981,
          "length": 97,
          "line": 64,
          "column": 1,
          "endLine": 64,
          "sha256Utf16LE": "1B11143E970C71CE6CDF1733616BEC9CCAFF6301F93AA3A030306DD20F46CE79"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      },
      {
        "relation": "#CatalogMediaAliasSourceCounts",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 19314,
          "length": 100,
          "line": 67,
          "column": 1,
          "endLine": 67,
          "sha256Utf16LE": "63D7E3CFF5C81738456DF19B58C480292D406F8E586203D7427880B8FC2585FF"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      },
      {
        "relation": "#StockMatches",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 21755,
          "length": 86,
          "line": 77,
          "column": 2,
          "endLine": 77,
          "sha256Utf16LE": "42DB4E5E34D509A7429CE8745EB1C4C855490250FD8C79C81AAE24F7001BA529"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      },
      {
        "relation": "#CatalogOrder",
        "kind": "SELECT_INTO_TEMP",
        "fragment": {
          "type": "SelectStatement",
          "offset": 22761,
          "length": 422,
          "line": 79,
          "column": 2,
          "endLine": 79,
          "sha256Utf16LE": "57355D75B5FF350E5CB1CA8063A054C9970209F85B591B87872C4870A343B2CE"
        },
        "references": {
          "variables": [
            "@sort"
          ],
          "relations": [
            "#CatalogClassification",
            "#StockMatches",
            "dbo.products"
          ]
        }
      },
      {
        "relation": "#StockPage",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 23254,
          "length": 83,
          "line": 81,
          "column": 2,
          "endLine": 81,
          "sha256Utf16LE": "D33E83CCD4143275D7FEB08669F9D5A2B592C745CF5317878BC54CC5A8068071"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      },
      {
        "relation": "#CatalogAliasTargetProducts",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 23672,
          "length": 81,
          "line": 84,
          "column": 2,
          "endLine": 84,
          "sha256Utf16LE": "ACD1387D5031766E7F624C365EECEB55AF72C760DC83653B5B6D4C7D5BFEEE67"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      },
      {
        "relation": "#CatalogAliasTargetSources",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 24112,
          "length": 84,
          "line": 87,
          "column": 1,
          "endLine": 87,
          "sha256Utf16LE": "F7658F483BE6B2D0F01E3F7DFF087BEC8B18823EC565274E59855B2583AD4C00"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      },
      {
        "relation": "#StockAliasPairs",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 24651,
          "length": 108,
          "line": 90,
          "column": 1,
          "endLine": 90,
          "sha256Utf16LE": "58EE9E29061576F7D6AF3430EE2F2AD3C4B7713B48DCA5DB88D54DC8E4C8EA11"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      },
      {
        "relation": "#StockAliasProductCounts",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 25196,
          "length": 90,
          "line": 93,
          "column": 1,
          "endLine": 93,
          "sha256Utf16LE": "C35347A36AE09027E8F20F8C64C0B7297DD12BD801865A3F2584F65111C88A87"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      },
      {
        "relation": "#StockAliasSourceCounts",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 25494,
          "length": 93,
          "line": 96,
          "column": 1,
          "endLine": 96,
          "sha256Utf16LE": "09C8D9257B4C42BCAAAE384FAEB64E4A272972E9E2348CDB4EFEDB8A0B35AC96"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      },
      {
        "relation": "#CatalogPageAcceptedBindings",
        "kind": "SELECT_INTO_TEMP",
        "fragment": {
          "type": "SelectStatement",
          "offset": 63186,
          "length": 220,
          "line": 162,
          "column": 1,
          "endLine": 162,
          "sha256Utf16LE": "0A493B75BC53C0FEE618AAB59E0D914F91F9FF2BF058B3E1B797F6263F3D4C96"
        },
        "references": {
          "variables": [],
          "relations": [
            "#StockPage",
            "erp_migration.goal7_source_version_products"
          ]
        }
      },
      {
        "relation": "#CatalogIndex",
        "kind": "CREATE_TEMP_TABLE",
        "fragment": {
          "type": "CreateTableStatement",
          "offset": 64615,
          "length": 304,
          "line": 168,
          "column": 2,
          "endLine": 168,
          "sha256Utf16LE": "2923A87B425DACDEBA391E7EB59DA6E0FE718218ABEE80727356206C6E3923D1"
        },
        "references": {
          "variables": [],
          "relations": []
        }
      },
      {
        "relation": "#CatalogNativePagePrices",
        "kind": "SELECT_INTO_TEMP",
        "fragment": {
          "type": "SelectStatement",
          "offset": 75860,
          "length": 130,
          "line": 185,
          "column": 1,
          "endLine": 185,
          "sha256Utf16LE": "EFB5AB419739F3B37F242BACDD2A0D4AB11E8BBBB14059CE6F336C8C65ACD68D"
        },
        "references": {
          "variables": [],
          "relations": [
            "#StockPage",
            "dbo.product_prices"
          ]
        }
      }
    ],
    "moduleExecuteAsOwner": true,
    "selectedProjectionCalls": 0
  }
]);

function hashDefinition(text) {
  return createHash('sha256').update(text, 'utf16le').digest('hex').toUpperCase();
}

function exactSlice(definition, fragment) {
  const { offset, length, sha256Utf16LE } = fragment;
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) ||
      offset < 0 || length <= 0 || offset + length > definition.length) {
    throw new Error('B6_QUERY_FRAGMENT_RANGE_MISMATCH');
  }
  const sql = definition.slice(offset, offset + length);
  if (hashDefinition(sql) !== sha256Utf16LE) throw new Error('B6_QUERY_FRAGMENT_HASH_MISMATCH');
  return sql;
}

/**
 * Return the unchanged final SELECT and original context slices.
 * schemaContext is source-ordered DECLARE / CREATE #temp / SELECT INTO #temp only.
 * It omits all temp population DML and all admission/guard/owner branches.
 * The caller must provide an isolated empty permanent schema. Parameter fragments
 * are original procedure declarations, not an automatically executable script:
 * required parameters have no initializer; selecting diagnostic values is explicit.
 * Local DECLARE initializers read users/permissions and the server clock.
 * Missing owner EXECUTE AS / metadata visibility and empty temp rows are material
 * diagnostic limits; the output is never a replay or admission proof.
 */
export function extractB6IsolatedQueryContext(moduleName, definition) {
  const map = B6_ISOLATED_SELECTED_QUERIES.find(item => item.module === moduleName);
  if (!map || typeof definition !== 'string' ||
      hashDefinition(definition) !== map.definitionHash) {
    throw new Error('B6_QUERY_FROZEN_DEFINITION_MISMATCH');
  }
  const schemaContext = [
    ...map.declareStatements.map(item => ({
      kind: 'DECLARE_VARIABLES', variables: item.variables,
      fragment: item.fragment, references: item.references,
    })),
    ...map.tempContext,
  ].sort((a, b) => a.fragment.offset - b.fragment.offset)
    .map(item => ({ ...item, sql: exactSlice(definition, item.fragment) }));
  const parameters = map.procedureParameters.map(item => ({
    ...item, sql: exactSlice(definition, item.fragment),
  }));
  const statementSql = exactSlice(definition, map.statement);
  const outerQuerySql = exactSlice(definition, map.outerQuery);
  const aggregates = map.aggregates.map(item => ({
    ...item,
    sql: exactSlice(definition, item.call),
    querySql: exactSlice(definition, item.query),
  }));
  return {
    classification: B6_ISOLATED_QUERY_ARTIFACT.classification,
    module: map.module, definitionHash: map.definitionHash,
    statement: map.statement, outerQuery: map.outerQuery,
    statementSql, outerQuerySql, parameters, schemaContext, aggregates,
    selectedReferences: map.selectedReferences, functions: map.functions,
    sourceExecuteAsOwner: map.moduleExecuteAsOwner,
    selectedProjectionCalls: map.selectedProjectionCalls,
    temporaryPopulationDmlIncluded: false,
    authorityOrRehearsal: false,
  };
}

