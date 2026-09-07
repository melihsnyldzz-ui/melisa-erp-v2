const string={type:'string'}, fields={type:'array',minItems:1,maxItems:40,uniqueItems:true,items:string};
const limit={type:'integer',minimum:1,maximum:50,default:50};
const filters={type:'array',maxItems:12,items:{type:'object',required:['field','op','value'],additionalProperties:false,properties:{field:string,op:{enum:['eq','ne','lt','lte','gt','gte','in','contains','is_null']},value:{description:'Typed scalar; decimal and bigint values must be strings. IN takes 1–25 scalars.'}}}};
const personal={includePersonalData:{type:'boolean'},purpose:{type:'string',minLength:10,maxLength:300}};
const definitions=[
 ['list_datasets','List all visible non-security tables and views, available fields, and permission/mapping barriers. One explicit source/company/period per dataset.',[],{source:{enum:['vega','melisa']},family:string,company:string,period:string,status:string,search:string,limit,cursor:string}],
 ['describe_dataset','Describe allowed fields and verified meanings, required currency/unit groups, source evidence and limitations. Field metadata is paginated.',['dataset'],{dataset:string,limit,cursor:string}],
 ['query_dataset','Read structured, parameterized filters over one dataset. Maximum 50 records per page; follow nextCursor for all matching records. No SQL or expressions.',['dataset'],{dataset:string,fields,filters,limit,cursor:string,...personal}],
 ['aggregate_dataset','Aggregate the complete database filter, never the first page. Count/count_distinct are available; sums/min/max require verified field measures and currency/unit scope. Exact numeric output is a string.',['dataset','metrics'],{dataset:string,filters,groupBy:{type:'array',maxItems:6,uniqueItems:true,items:string},metrics:{type:'array',minItems:1,maxItems:8,items:{type:'object',required:['op','as'],additionalProperties:false,properties:{op:{enum:['count','count_distinct','sum','min','max']},field:string,as:{type:'string',pattern:'^[a-z][a-z0-9_]{0,30}$'}}}},limit,cursor:string}],
 ['get_record','Read an exact source primary key, with optional explicitly requested personal contact fields for a single justified record.',['dataset','key'],{dataset:string,key:{type:'object'},fields,...personal}],
 ['get_document','Read a verified purchase/sales invoice header and paginated lines in the same company/period. Other relationships fail closed until independently mapped.',['dataset','key'],{dataset:string,key:{type:'object'},headerFields:fields,lineFields:fields,limit,cursor:string}],
];
export const commercialTools=definitions.map(([name,description,required,properties])=>({name,description,inputSchema:{type:'object',required,properties,additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}));

const scope={company:{type:'string',pattern:'^F[0-9]{4}$'},period:{type:'string',pattern:'^D[0-9]{4}$'}};
const page={limit,cursor:string}, stockId={type:'integer',minimum:1},accountId={type:'integer',minimum:1};
const range={dateFrom:{type:'string',format:'date',description:'Inclusive date, required.'},dateTo:{type:'string',format:'date',description:'Exclusive end date; at most 366 days after dateFrom.'}};
const domainDefinitions=[
 ['get_commercial_inventory','Administrator: discover registered source periods, family availability, missing permissions and unsupported calculations.',[],scope],
 ['get_stock_quantities','Administrator: paginated source stock quantity; mixed/missing units or quantities remain unknown.',[],{...scope,...page,stockId}],
 ['get_product_units','Administrator: recorded units, barcodes and conversion factors; no inferred package/piece conversion.',['stockId'],{...scope,...page,stockId}],
 ['get_product_variants','Administrator: source serial numbers or series definitions. Empty scope is not proof of missing history.',['stockId','kind'],{...scope,...page,stockId,kind:{enum:['serial_numbers','series_1','series_2']}}],
 ['get_stock_movements','Administrator: bounded raw stock movements with explicit dates, source units and event codes.',['dateFrom','dateTo'],{...scope,...page,...range,stockId}],
 ['get_product_prices','Administrator: recorded price slots and their currencies for each product unit. Not an approved offer.',['stockId'],{...scope,...page,stockId}],
 ['get_product_costs','Administrator: recorded movement cost fields. Verified cost/profit remains unavailable until transaction snapshot provenance is established.',['stockId','dateFrom','dateTo'],{...scope,...page,...range,stockId}],
 ['list_accounts','Administrator: paginated account cards, recorded currency and country label, without personal contact details.',[],{...scope,...page,accountId}],
 ['get_account_ledger','Administrator: scoped ledger and recorded due dates; missing rates/amounts remain null.',['accountId','dateFrom','dateTo'],{...scope,...page,...range,accountId}],
 ['get_account_balance','Administrator: net ledger effect in the explicit period/date range, grouped by currency; not settled overdue debt.',['accountId','dateFrom','dateTo'],{...scope,...range,accountId}],
 ['list_commercial_documents','Administrator: sale/purchase headers and returns with explicit source cancellation state.',['kind','dateFrom','dateTo'],{...scope,...page,...range,kind:{enum:['sale_stock_exit','purchase_stock_entry','sales_invoice','purchase_invoice']},returns:{type:'boolean'}}],
 ['get_sales_report','Administrator: ranked sales/returns basis by product, brand, customer or recorded country; incomplete totals remain null.',['dimension','dateFrom','dateTo'],{...scope,...page,...range,dimension:{enum:['product','brand','customer','country']}}],
 ['get_inventory_report','Administrator: no-sales candidates, declining stock or recorded low threshold within the requested window. Not complete lifetime history.',['kind','dateFrom','dateTo'],{...scope,...page,...range,kind:{enum:['no_sales','decreasing','below_recorded_threshold']}}],
 ['search_catalog','Customer-safe stock-code search returning only product labels and brand/category; no price, stock quantity or financial fields.',[],{query:string,...page}],
 ['get_product_image','Read one mapped product image as authenticated MCP image content, not a local file path. Missing mapping permission and missing image are distinct.',['stockCode'],{stockCode:{type:'string',minLength:1,maxLength:120}}],
];
export const domainTools=domainDefinitions.map(([name,description,required,properties])=>({name,description,inputSchema:{type:'object',required,properties,additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}));
