#!/usr/bin/env node

/*
 * Generate ESPD Request and ESPD Response XML files from Excel
 * Follow the XSLT logic and rules
 */

var XLSX = require("xlsx")
var chalk = require('chalk')
var fs = require("fs")
const { create } = require('xmlbuilder2')
const { program } = require("@caporal/core")
const path = require("path")
const uuid_v4 = require('crypto')

//Tags mapped to elements from the Excel 
const tag_map = {
    'CRITERION': 'C',
    'ADDITIONAL_DESCRIPTION_LINE': 'ADL',
    'SUBCRITERION': 'SBC',
    'LEGISLATION': 'L',
    'REQUIREMENT_GROUP': 'RG',
    'QUESTION_GROUP': 'QG',
    'REQUIREMENT_SUBGROUP': 'RSG',
    'QUESTION_SUBGROUP': 'QSG',
    'CAPTION': 'CA',
    'REQUIREMENT': 'RQ',
    'QUESTION': 'Q',
    'RESPONSE': 'R',
    'RESPONSE VALUE': 'RV',
    'EVIDENCE SUPPLIED': 'RES',
    'APPLICABLE PERIOD': 'RAP',
}
var counter = {
    'C': 0,
    'ADL': 0,
    'SBC': 0,
    'L': 0,
    'RG': 0,
    'QG': 0,
    'RSG': 0,
    'QSG': 0,
    'CA': 0,
    'RQ': 0,
    'Q': 0,
    'R': 0,
    'RV': 0,
    'RES': 0,
    'RAP': 0,
}
const namespace_map = {
    'EG-': '_EG_',
    'SC-': '_SC_',
    'SC_': '_SC_',
    'OTHER-': '_OT_',
    'OTHER.': '_OT_'
}
const schemeVersionID = '4.0.0'

//Tags mapped to elements from the Excel 
/**
 * Name	
 * Description	
 * Buyer Value (example)	
 * Seller Value (example)	
 * Cardinality	
 * PropertyDataType	
 * XML PATH Like VARIANT ID Request	
 * ElementUUID	
 * XML PATH LIKE VARIANT ID Response Structure	
 * XML PATH LIKE VARIANT ID Response Contents (1)	
 * XML PATH LIKE VARIANT ID Response Contents (2)	
 * XML PATH LIKE VARIANT ID Response Contents (3)	
 * Element Code	
 * Code List	
 * Comment
 */
const cols = {
    name: {
        label: "Name",
        column: 0
    },
    description: {
        label: "Description",
        column: 0
    },
    buyervalue: {
        label: "Buyer Value (example)",
        column: 0
    },
    sellervalue: {
        label: "Seller Value (example)",
        column: 0
    },
    cardinality: {
        label: "Cardinality",
        column: 0
    },
    propertydatatype: {
        label: "PropertyDataType",
        column: 0
    },
    elementUUID: {
        label: 'ElementUUID',
        column: 0
    },
    elementcode: {
        label: "Element Code",
        column: 0
    },
    codelist: {
        label: "Code List",
        column: 0
    },
    comment: {
        label: "Comment",
        column: 0
    },
    requestpath: {
        label: "XML PATH Like VARIANT ID Request",
        column: 0
    },
    responsepath: {
        label: "XML PATH LIKE VARIANT ID Response Structure",
        column: 0
    },
    responsecontent1: {
        label: "XML PATH LIKE VARIANT ID Response Contents (1)",
        column: 0
    },
    responsecontent2: {
        label: "XML PATH LIKE VARIANT ID Response Contents (2)",
        column: 0
    },
    responsecontent3: {
        label: "XML PATH LIKE VARIANT ID Response Contents (3)",
        column: 0
    }
};

const in_excel_we_trust = [
    //"ESPD-criterion-request-multiple-C25-C32.xlsx",
    "ESPD-criterion-response-multiple-C1-C25-C32.xlsx"
]

//Check the complete list of invalid CRITERION
const invalid_criterion = [33, 62, 64]

const log = console.log;
XLSX.set_fs(fs);
let element_children = {}

var espd_json = {}, evidence_ids = []

var espd_request = create({
    version: '1.0',
    encoding: 'UTF-8',
    defaultNamespace: { ele: 'urn:oasis:names:specification:ubl:schema:xsd:QualificationApplicationRequest-2', att: null },
    namespaceAlias: { cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2', cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2' }
})
    .ele('QualificationApplicationRequest')
    .att('http://www.w3.org/2001/XMLSchema-instance', 'xsi:schemaLocation', 'urn:oasis:names:specification:ubl:schema:xsd:QualificationApplicationRequest-2 ../xsdrt/maindoc/UBL-QualificationApplicationRequest-2.3.xsd')
    .att('@xmlns', 'xmlns:fn', 'http://www.w3.org/2005/xpath-functions')
    .att('@xmlns', 'xmlns:xs', 'http://www.w3.org/2001/XMLSchema')
    .att('@xmlns', 'xmlns:cac', 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2')
    .att('@xmlns', 'xmlns:cbc', 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2')
    .att('@xmlns', 'xmlns:espd', `urn:com:grow:espd:${schemeVersionID}`)
    .att('@xmlns', 'xmlns:text', 'urn:oasis:names:tc:opendocument:xmlns:text:1.0')
    .att('@xmlns', 'xmlns:util', 'java:java.util.UUID')
    .att('@xmlns', 'xmlns:style', 'urn:oasis:names:tc:opendocument:xmlns:style:1.0')
    .att('@xmlns', 'xmlns:table', 'urn:oasis:names:tc:opendocument:xmlns:table:1.0')
    .att('@xmlns', 'xmlns:office', 'urn:oasis:names:tc:opendocument:xmlns:office:1.0')
    ,
    espd_response = create({
        version: '1.0',
        encoding: 'UTF-8',
        defaultNamespace: { ele: 'urn:oasis:names:specification:ubl:schema:xsd:QualificationApplicationResponse-2', att: null },
        namespaceAlias: { cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2', cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2' }
    })
        .ele('QualificationApplicationResponse')
        .att('http://www.w3.org/2001/XMLSchema-instance', 'xsi:schemaLocation', 'urn:oasis:names:specification:ubl:schema:xsd:QualificationApplicationResponse-2 ../xsdrt/maindoc/UBL-QualificationApplicationResponse-2.3.xsd')
        .att('@xmlns', 'xmlns:fn', 'http://www.w3.org/2005/xpath-functions')
        .att('@xmlns', 'xmlns:xs', 'http://www.w3.org/2001/XMLSchema')
        .att('@xmlns', 'xmlns:cac', 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2')
        .att('@xmlns', 'xmlns:cbc', 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2')
        .att('@xmlns', 'xmlns:espd', `urn:com:grow:espd:${schemeVersionID}`)


program
    .version("1.0.0")
    .name("excel2espd")
    .description("Tool to generate ESDP XML file from Excel Criterion files")

    .command("all_JSON", "Print all spreadsheets as JSON")
    .action(({ logger, args, options }) => {
        // Combine styled and normal strings
        log(chalk.blue.bold('UUID checking'), chalk.red('for ESPD realease v4.0.0.'));
        log('\n\n')

        in_excel_we_trust.forEach(xcl => {
            var wbk = XLSX.readFile(xcl),
                what = xcl.indexOf('-request-') != -1
            log(chalk.bold(xcl))

            var sheet_name_list = wbk.SheetNames;
            counter[tag_map['CRITERION']] = 0

            for (const i in sheet_name_list) {
                log(''.padStart(80, '_'))
                log(chalk.bold(sheet_name_list[i]))
                all_JSON(wbk.Sheets[sheet_name_list[i]])
                log('\n\n')
            }
        })

    })

    .command("full_structures", "Print full structure of each spreadsheet")
    .action(({ logger, args, options }) => {
        // Combine styled and normal strings
        log(chalk.blue.bold('UUID checking'), chalk.red('for ESPD realease v4.0.0.'));
        log('\n\n')

        in_excel_we_trust.forEach(xcl => {
            var wbk = XLSX.readFile(xcl),
                what = xcl.indexOf('-request-') != -1
            log(chalk.bold(xcl))

            var sheet_name_list = wbk.SheetNames;
            counter[tag_map['CRITERION']] = 0

            for (const i in sheet_name_list) {
                log(''.padStart(80, '_'))
                log(chalk.bold(sheet_name_list[i]))
                print_structures(wbk.Sheets[sheet_name_list[i]])
                log('\n\n')
            }
        })
    })

    .command("each_structure", "Print the element and child structure")
    .action(({ logger, args, options }) => {
        // Combine styled and normal strings
        log(chalk.blue.bold('UUID checking'), chalk.red('for ESPD realease v4.0.0.'));
        log('\n\n')

        element_children = {};

        in_excel_we_trust.forEach(xcl => {
            var wbk = XLSX.readFile(xcl),
                what = xcl.indexOf('-request-') != -1
            log(chalk.bold(xcl))

            var sheet_name_list = wbk.SheetNames;

            for (const i in sheet_name_list) {
                //log(''.padStart(80, '_'))
                //log(chalk.bold(sheet_name_list[i]))
                //detect elements structure
                detect_structure(wbk.Sheets[sheet_name_list[i]])
                //log('\n\n')
            }

            //print the structure
            for (const elm in element_children) {
                log(chalk.greenBright(elm))
                for (const child of element_children[elm]) {
                    log('\t', chalk.blue(child))
                }
            }
        })
    })

    .command("check_tag", "Check the TAGS for each element")
    .action(({ logger, args, options }) => {
        // Combine styled and normal strings
        log(chalk.blue.bold('UUID checking'), chalk.red('for ESPD realease v4.0.0.'));
        log('\n\n')

        in_excel_we_trust.forEach(xcl => {
            var wbk = XLSX.readFile(xcl),
                what = xcl.indexOf('-request-') != -1
            log(chalk.bold(xcl))

            var sheet_name_list = wbk.SheetNames;
            counter[tag_map['CRITERION']] = 0

            for (const i in sheet_name_list) {
                log(''.padStart(80, '_'))
                log(chalk.bold(sheet_name_list[i]))
                check_tags(wbk.Sheets[sheet_name_list[i]], what)
                log('\n\n')
            }
        })
    })

    .command("check_UUID", "Check the XML like path IDs for each element")
    .action(({ logger, args, options }) => {
        // Combine styled and normal strings
        log(chalk.blue.bold('UUID checking'), chalk.red('for ESPD realease v4.0.0.'));
        log('\n\n')

        in_excel_we_trust.forEach(xcl => {
            var wbk = XLSX.readFile(xcl),
                what = xcl.indexOf('-request-') != -1
            log(chalk.bold(xcl))

            var sheet_name_list = wbk.SheetNames;
            counter[tag_map['CRITERION']] = 0

            for (const i in sheet_name_list) {
                log(''.padStart(80, '_'))
                log(chalk.bold(sheet_name_list[i]))
                check_UUID_path(wbk.Sheets[sheet_name_list[i]], what, sheet_name_list[i])
                log('\n\n')
            }
        })
    })

    .command("espd_XML", "Generate ESPD Request and Response XML files")
    .action(({ logger, args, options }) => {
        log(chalk.blue.bold('Excel to XML transformation'), chalk.red('for ESPD realease v4.0.0.'));
        log('\n\n')

        createRootElements()

        in_excel_we_trust.forEach(xcl => {
            var wbk = XLSX.readFile(xcl)
            //log(chalk.bold(xcl))
            var sheet_name_list = wbk.SheetNames
            counter[tag_map['CRITERION']] = 0

            for (const i in sheet_name_list) {
                if (Object.hasOwn(sheet_name_list, i)) {
                    const element = sheet_name_list[i];
                    //log(''.padStart(80, '_'))
                    //log(chalk.bold(element))
                    espd_JSON(wbk.Sheets[element], element)
                    //log('\n\n')
                }
            }
        })

        log(JSON.stringify(espd_json, null, ' '))

        //render the JSON
        render_request(espd_json)
        render_request(espd_json, espd_response)
        render_response(espd_json, espd_response)

        createEvidence()
        //log(espd_request.end({ prettyPrint: true }))
        writeXMLfiles()


        //espd_response.doc()
        //log(espd_response.end({ prettyPrint: true }))

    })


// launch the main loop
program.run()


//create the ESPD Request and Response XML JSON structures
/**
 * 
 */
function espd_JSON(sph, sheetname) {
    //TODO
    var xlData = XLSX.utils.sheet_to_json(sph)

    let c_obj = {},
        c_type = (sheetname.startsWith('EG') ? 'EG' : (sheetname.startsWith('SC') ? 'SC' : 'OT')),
        element_map = [];
    //reset the level counter
    for (const key in counter) {
        if (Object.hasOwn(counter, key)) {
            counter[key] = 0
        }
    }

    xlData.forEach(element => {

        //Detect the column for each label
        for (const key in cols) {
            let lbl = cols[key].label
            if (Object.values(element).indexOf(lbl) != -1) {
                cols[key].column = Object.keys(element)[Object.values(element).indexOf(lbl)]
            }
        }

        //get the tag
        let col_idx = 1, tag = '', tmp_elm = {}, parent = {}

        do {
            //no entry
            if (typeof element[col_idx] === 'undefined') {
                col_idx++
                continue
            }
            //empty entry
            if (element[col_idx].toString().trim().length == 0) {
                col_idx++
                continue
            }
            let elm = element[col_idx].toString().trim()
            //start tag
            if (elm.startsWith('{') && !elm.endsWith('}')) {
                tag = elm.replace('{', '').replace('}', '')
                //log(tag)
                switch (tag) {
                    case 'CRITERION':
                        c_obj.tag = `C${element[col_idx - 1]} - ${c_type}` //this assumes that the CRITERION number is in column 1
                        c_obj.type = tag
                        for (const key in cols) {
                            let lbl = cols[key].label, clm = cols[key].column
                            if (clm > 0 && typeof element[clm] !== 'undefined' && element[clm].toString().trim().length > 0) {
                                c_obj[key] = element[clm].toString().trim()
                            }
                        }
                        c_obj.components = {}
                        break;

                    case 'SUBCRITERION': case 'REQUIREMENT_GROUP':
                    case 'QUESTION_GROUP': case 'QUESTION_SUBGROUP':
                    case 'REQUIREMENT_SUBGROUP':
                        if (!Object.hasOwn(c_obj, 'components')) c_obj.components = {}
                        parent = c_obj.components
                        if (element_map.length > 0) {
                            parent = element_map.reduce((acc, crtVal) => {
                                if (!Object.hasOwn(acc[crtVal], 'components')) acc[crtVal].components = {}
                                return acc[crtVal].components
                            }, parent)
                        }
                        counter[tag_map[tag]]++

                        tmp_elm = {}
                        tmp_elm.type = tag
                        for (const key in cols) {
                            let lbl = cols[key].label, clm = cols[key].column
                            if (clm > 0 && typeof element[clm] !== 'undefined' && element[clm].toString().trim().length > 0) {
                                tmp_elm[key] = element[clm].toString().trim()
                            }
                        }
                        if (!Object.hasOwn(tmp_elm, 'cardinality')) tmp_elm['cardinality'] = 1
                        tmp_elm.components = {}
                        parent[`${tag_map[tag]}${counter[tag_map[tag]]}`] = tmp_elm
                        element_map.push(`${tag_map[tag]}${counter[tag_map[tag]]}`)

                        break;

                    default:
                        break;
                }

                break
            }

            //one line tag
            if (elm.startsWith('{') && elm.endsWith('}')) {
                tag = elm.replace('{', '').replace('}', '')
                //log(tag)
                switch (tag) {
                    case 'ADDITIONAL_DESCRIPTION_LINE': case 'LEGISLATION':
                    case 'CAPTION': case 'QUESTION': case 'REQUIREMENT':

                        if (!Object.hasOwn(c_obj, 'components')) c_obj.components = {}
                        parent = c_obj.components
                        if (element_map.length > 0) {
                            parent = element_map.reduce((acc, crtVal) => {
                                if (!Object.hasOwn(acc[crtVal], 'components')) acc[crtVal].components = {}
                                return acc[crtVal].components
                            }, parent)
                        }
                        counter[tag_map[tag]]++


                        tmp_elm = {}
                        tmp_elm.type = tag
                        for (const key in cols) {
                            let lbl = cols[key].label, clm = cols[key].column
                            if (clm > 0 && typeof element[clm] !== 'undefined' && element[clm].toString().trim().length > 0) {
                                tmp_elm[key] = element[clm].toString().trim()
                            }
                        }
                        if (!Object.hasOwn(tmp_elm, 'cardinality')) tmp_elm['cardinality'] = 1
                        parent[`${tag_map[tag]}${counter[tag_map[tag]]}`] = tmp_elm
                        break;


                    default:
                        break;
                }
                break
            }

            //end tag
            if (!elm.startsWith('{') && elm.endsWith('}')) {
                tag = elm.replace('{', '').replace('}', '')
                //log(tag)

                switch (tag) {
                    case 'CRITERION':
                        //log(c_obj)
                        espd_json[c_obj.tag.substring(0, c_obj.tag.indexOf('-') - 1)] = c_obj
                        c_obj = {}
                        //reset the level counter
                        for (const key in counter) {
                            if (Object.hasOwn(counter, key)) {
                                counter[key] = 0
                            }
                        }
                        break;
                    case 'SUBCRITERION': case 'REQUIREMENT_GROUP':
                    case 'QUESTION_GROUP': case 'QUESTION_SUBGROUP':
                    case 'REQUIREMENT_SUBGROUP':
                        //counter[tag_map[tag]]--
                        element_map.pop()
                        break;
                    default:
                        break;
                }

                break
            }
            //some other text or empty line
            col_idx++
        } while (col_idx <= 17)

        if (col_idx == 18 && tag == '') {
            //empty line or does not contain any tag
            //log(chalk.bgRed.white('Empty row'))
            return
        }

    })

}

//check the green label before each element in the Excel file
//tags are unique per level
//the numbering of same tags on the same level is continuous
//CRITERION numbering is continuous over the entire workbook --- exceptions to be taken into account from invalid_criterion
function check_tags(sph, IS_REQUEST) {
    var xlData = XLSX.utils.sheet_to_json(sph)
    var crt_structure = {}

    xlData.forEach(element => {

        //Detect the column for each label
        for (const key in cols) {
            let lbl = cols[key].label
            if (Object.values(element).indexOf(lbl) != -1) {
                cols[key].column = Object.keys(element)[Object.values(element).indexOf(lbl)]
                //log(cols[key].label, cols[key].column)
            }
        }

        //get the tag
        let col_idx = 1
        let tag = ''

        do {
            //no entry
            if (typeof element[col_idx] === 'undefined') {
                col_idx++
                continue
            }
            //empty entry
            if (element[col_idx].trim().length == 0) {
                col_idx++
                continue
            }
            //tag
            if (element[col_idx].trim().startsWith('{') || element[col_idx].trim().endsWith('}')) {
                tag = element[col_idx].trim().replace('{', '').replace('}', '')

                //start tag
                if (element[col_idx].trim().startsWith('{') &&
                    !element[col_idx].trim().endsWith('}')) {
                    if (tag == 'CRITERION') {
                        counter[tag_map[tag]]++
                        //skip the invalid CRITERION numbers
                        if (invalid_criterion.indexOf(counter[tag_map[tag]]) != -1) {
                            counter[tag_map[tag]]++
                        }
                    }
                    //for the other elements have to compute the corresponding level
                    if (typeof crt_structure[col_idx - 2] === 'undefined') crt_structure[col_idx - 2] = {}

                    if (typeof crt_structure[col_idx - 2][tag_map[tag]] === 'undefined') {
                        crt_structure[col_idx - 2][tag_map[tag]] = 1
                    } else {

                        //process the cardinality
                        if (` ${element[cols.cardinality.column]}`.indexOf('(') != -1) {
                            let card = element[cols.cardinality.column].match(/\([\d]\)/g)[0].replace('(', '').replace(')', '')
                            if (card == 1) crt_structure[col_idx - 2][tag_map[tag]]++
                        } else {
                            crt_structure[col_idx - 2][tag_map[tag]]++
                        }

                    }

                    crt_structure[0][tag_map['CRITERION']] = counter[tag_map['CRITERION']]

                    const tag_ok = element[col_idx - 1] == `${tag_map[tag]}${crt_structure[col_idx - 2][tag_map[tag]]}`

                    if (!tag_ok) log(`${tag_map[tag]}${crt_structure[col_idx - 2][tag_map[tag]]}`)
                    //print the result
                    log(tag_ok ? chalk.bold.green('[OK]\t') : chalk.bold.red('[NOK]\t'),
                        chalk.green(element[col_idx - 1]), '\t',
                        ''.padStart(col_idx - 2, '\t'),
                        chalk.bgWhite.black(tag))

                }

                //one line tag
                if (element[col_idx].trim().startsWith('{') &&
                    element[col_idx].trim().endsWith('}')) {
                    if (typeof crt_structure[col_idx - 2] === 'undefined') crt_structure[col_idx - 2] = {}
                    if (typeof crt_structure[col_idx - 2][tag_map[tag]] === 'undefined') {
                        crt_structure[col_idx - 2][tag_map[tag]] = 1
                    } else {
                        if (` ${element[cols.cardinality.column]}`.indexOf('(') == -1) {
                            crt_structure[col_idx - 2][tag_map[tag]]++
                        }
                    }
                    const tag_ok = element[col_idx - 1] == `${tag_map[tag]}${crt_structure[col_idx - 2][tag_map[tag]]}`

                    //print the result
                    log(tag_ok ? chalk.bold.green('[OK]\t') : chalk.bold.red('[NOK]\t'),
                        chalk.green(element[col_idx - 1]), '\t',
                        ''.padStart(col_idx - 2, '\t'),
                        chalk.bgWhite.black(tag))
                }

                //end tag
                if (!element[col_idx].trim().startsWith('{') &&
                    element[col_idx].trim().endsWith('}')) {
                    if (tag == 'CRITERION') crt_structure = {}
                    delete crt_structure[col_idx - 1]
                }

                //log(tag)
                break
            }
            //some other text
            col_idx++
        } while (col_idx <= 17)

        if (col_idx == 18 && tag == '') {
            //empty line or does not contain any tag
            //log(chalk.bgRed.white('Empty row'))
            return
        }

    });
}

//check the XML like path that is generated for each element
//the path for Request is in the column 23 and is only for opening tags or one line tags
//the path for Response is in the columns 24 as Request and for each variant of response in cols: 26, 27, 28, 29
//the namespace is composed from: CRITERION-NUMBER::namespace_map::Element Code (Crierion line, column 25 for Reques and column 30 for Response)
//the other rules:
// - concatenate the path for each child element
function check_UUID_path(sph, IS_REQUEST, sheetname) {
    //IS_REQUEST = true -> Request Excel file, otehrwise Response Excel file

    var xlData = XLSX.utils.sheet_to_json(sph)
    let crt_structure = {}
    let root_element = ''
    let path_structure = []
    let end_path = [], res_end_path = [];
    let tag_path = [], res_tag_path = [];

    xlData.forEach(element => {

        //Detect the column for each label
        for (const key in cols) {
            let lbl = cols[key].label
            if (Object.values(element).indexOf(lbl) != -1) {
                cols[key].column = Object.keys(element)[Object.values(element).indexOf(lbl)]
                //log(cols[key].label, cols[key].column)
            }
        }

        //get the tag
        let col_idx = 1
        let tag = ''


        do {
            //no entry
            if (typeof element[col_idx] === 'undefined') {
                col_idx++
                continue
            }
            //empty entry
            if (element[col_idx].trim().length == 0) {
                col_idx++
                continue
            }
            //tag
            if (element[col_idx].trim().startsWith('{') || element[col_idx].trim().endsWith('}')) {
                tag = element[col_idx].trim().replace('{', '').replace('}', '')

                //start tag
                if (element[col_idx].trim().startsWith('{') &&
                    !element[col_idx].trim().endsWith('}')) {

                    if (tag == 'CRITERION') {
                        counter[tag_map[tag]]++
                        //skip the invalid CRITERION numbers
                        if (invalid_criterion.indexOf(counter[tag_map[tag]]) != -1) {
                            counter[tag_map[tag]]++
                        }
                        //create root element
                        var ns = ''
                        for (const p in namespace_map) {
                            if (sheetname.startsWith(p)) {
                                ns = namespace_map[p]
                                break
                            }
                        }

                        root_element = `${tag_map[tag]}${counter[tag_map[tag]]}${ns}${element[cols.elementcode.column]}`

                        path_structure.push(root_element)
                    }

                    //for the other elements have to compute the corresponding level
                    if (typeof crt_structure[col_idx - 2] === 'undefined') crt_structure[col_idx - 2] = {}

                    if (typeof crt_structure[col_idx - 2][tag_map[tag]] === 'undefined') {
                        crt_structure[col_idx - 2][tag_map[tag]] = 1
                    } else {
                        if (!IS_REQUEST) {
                            //process the cardinality
                            if (` ${element[cols.cardinality.column]}`.indexOf('(') != -1) {
                                let card = element[cols.cardinality.column].match(/\([\d]\)/g)[0].replace('(', '').replace(')', '')
                                if (card == 1) crt_structure[col_idx - 2][tag_map[tag]]++
                            } else {
                                crt_structure[col_idx - 2][tag_map[tag]]++
                            }
                        } else if (` ${element[cols.cardinality.column]}`.indexOf('(') == -1) {
                            crt_structure[col_idx - 2][tag_map[tag]]++
                        }
                    }

                    crt_structure[0][tag_map['CRITERION']] = counter[tag_map['CRITERION']]

                    if (tag != 'CRITERION') {
                        path_structure.push(`${tag_map[tag]}${crt_structure[col_idx - 2][tag_map[tag]]}`)
                    }

                    let tag_ok = false, computed_path = path_structure.join('/')

                    if (tag == 'REQUIREMENT_GROUP' || tag == 'REQUIREMENT_SUBGROUP') {
                        if (` ${element[cols.cardinality.column]}`.indexOf('(') != -1) {
                            let card = element[cols.cardinality.column].match(/\([\d]\)/g)[0].replace('(', '').replace(')', '')
                            end_path.push(`/R${card}`)
                        } else if (` ${element[cols.cardinality.column]}`.indexOf('..n') != -1) {
                            end_path.push('/R1')
                        } else if (` ${element[cols.cardinality.column]}`.indexOf('0..1') != -1 || `${element[cols.cardinality.column]}` == '1') {
                            end_path.push('')
                        }
                        tag_path.push(tag)

                        //log(end_path.reduce((acc, crtval) => crtval.length==0?acc:acc+crtval, ''), tag, tag_path.join(':'))
                    }

                    //Response processing
                    if (!IS_REQUEST) {
                        //if(tag == 'QUESTION_GROUP' || tag == 'QUESTION_SUBGROUP'){

                        if (` ${element[cols.cardinality.column]}`.indexOf('(') != -1) {
                            let card = element[cols.cardinality.column].match(/\([\d]\)/g)[0].replace('(', '').replace(')', '')
                            res_end_path.push(`/R${card}`)
                        } else if (` ${element[cols.cardinality.column]}`.indexOf('..n') != -1) {
                            res_end_path.push('/R1')
                        } else if (` ${element[cols.cardinality.column]}`.indexOf('0..1') != -1 || `${element[cols.cardinality.column]}` == '1') {
                            res_end_path.push('')
                        }
                        res_tag_path.push(tag)
                        //log(res_end_path.reduce((acc, crtval) => crtval.length==0?acc:acc+crtval, ''), tag, ' -> ', res_tag_path.join(':'))
                        //}
                    }



                    tag_ok = (element[cols.requestpath.column].trim() == computed_path)

                    //print the result
                    log(tag_ok ? chalk.bold.green('[OK]\t') : chalk.bold.red('[NOK]\t'),
                        chalk.green(element[col_idx - 1]), '\t',
                        chalk.green(element[cols.requestpath.column].trim().padEnd(60)), '\t',
                        chalk.blue(computed_path.padEnd(60)), '\t',
                        ''.padStart(col_idx - 2, '\t'),
                        chalk.bgWhite.black(tag))

                }

                //one line tag
                if (element[col_idx].trim().startsWith('{') &&
                    element[col_idx].trim().endsWith('}')) {

                    if (typeof crt_structure[col_idx - 2] === 'undefined') crt_structure[col_idx - 2] = {}

                    if (typeof crt_structure[col_idx - 2][tag_map[tag]] === 'undefined') {
                        crt_structure[col_idx - 2][tag_map[tag]] = 1
                    } else {
                        if (` ${element[cols.cardinality.column]}`.indexOf('(') == -1) {
                            crt_structure[col_idx - 2][tag_map[tag]]++
                        }
                    }

                    if (tag != 'CRITERION') {
                        path_structure.push(`${tag_map[tag]}${crt_structure[col_idx - 2][tag_map[tag]]}`)
                    }

                    let computed_path = path_structure.join('/'), res_computed_path = path_structure.join('/');

                    if (tag == 'REQUIREMENT') {
                        if (` ${element[cols.cardinality.column]}`.indexOf('(') != -1) {
                            let card = element[cols.cardinality.column].match(/\([\d]\)/g)[0].replace('(', '').replace(')', '')
                            end_path.push(`/R${card}`)
                        } else {
                            end_path.push('/R1')
                        }
                        //log(end_path.reduce((acc, crtval) => crtval.length==0?acc:acc+crtval, ''), tag)
                        computed_path = computed_path.concat(end_path.reduce((acc, crtval) => crtval.length == 0 ? acc : acc + crtval, ''))
                        end_path.pop()
                    }

                    //Response QUESTION tag
                    if (!IS_REQUEST) {
                        if (tag == 'QUESTION') {
                            res_end_path.push('/R1')
                            let val_path = element[cols.propertydatatype.column] == 'PERIOD' ? '/RAP' : (element[cols.propertydatatype.column] == 'EVIDENCE_IDENTIFIER' ? '/RES' : '/RV')

                            //log(res_end_path.reduce((acc, crtval) => crtval.length==0?acc:acc+crtval, ''), tag)
                            res_computed_path = res_computed_path.concat(res_end_path.reduce((acc, crtval) => crtval.length == 0 ? acc : acc + crtval, ''))
                            res_end_path.pop()


                            let check1 = res_computed_path == element[cols.responsecontent1.column], check3 = res_computed_path.concat(val_path) == element[cols.responsecontent3.column];

                            log(check1 ? chalk.bold.green('[OK]\t') : chalk.bold.red('[NOK]\t'),
                                chalk.green(element[col_idx - 1]), '\t',
                                chalk.green(element[cols.responsecontent1.column].trim().padEnd(60)), '\t',
                                chalk.blue(res_computed_path.padEnd(60)), '\t',
                                ''.padStart(col_idx - 2, '\t'),
                                chalk.bgWhite.black(tag))

                            log(check3 ? chalk.bold.green('[OK]\t') : chalk.bold.red('[NOK]\t'),
                                chalk.green(element[col_idx - 1]), '\t',
                                chalk.green(element[cols.responsecontent3.column].trim().padEnd(60)), '\t',
                                chalk.blue(res_computed_path.concat(val_path).padEnd(60)), '\t',
                                ''.padStart(col_idx - 2, '\t'),
                                chalk.bgWhite.black(tag))
                        }

                    }


                    let tag_ok = (element[cols.requestpath.column].trim() == computed_path)

                    //print the result
                    log(tag_ok ? chalk.bold.green('[OK]\t') : chalk.bold.red('[NOK]\t'),
                        chalk.green(element[col_idx - 1]), '\t',
                        chalk.green(element[cols.requestpath.column].trim().padEnd(60)), '\t',
                        chalk.blue(computed_path.padEnd(60)), '\t',
                        ''.padStart(col_idx - 2, '\t'),
                        chalk.bgWhite.black(tag))

                    path_structure.pop()

                }

                //end tag
                if (!element[col_idx].trim().startsWith('{') && element[col_idx].trim().endsWith('}')) {

                    if (tag == 'CRITERION') {
                        crt_structure = {}
                        path_structure = []
                        end_path = []
                        tag_path = []
                        res_end_path = []
                        res_tag_path = []
                    }
                    delete crt_structure[col_idx - 1]
                    path_structure.pop()


                    if (tag == tag_path[tag_path.length - 1]) {
                        end_path.pop()
                        tag_path.pop()
                    }

                    if (tag == res_tag_path[res_tag_path.length - 1]) {
                        res_end_path.pop()
                        res_tag_path.pop()
                    }
                }

                //log(tag)
                break
            }
            //some other text
            col_idx++
        } while (col_idx <= 17)

        if (col_idx == 18 && tag == '') {
            //empty line or does not contain any tag
            //log(chalk.bgRed.white('Empty row'))
            return
        }

    });
}

//detect and print the structure of the objects
//as described in col2-col17
function print_structures(sph) {
    var xlData = XLSX.utils.sheet_to_json(sph)

    let cardinality = 1

    xlData.forEach(element => {

        //log(element)
        if (Object.values(element).indexOf('Cardinality') != -1) {
            cardinality = Object.keys(element)[Object.values(element).indexOf('Cardinality')]
            //log(cardinality, element[cardinality])
        }

        //get the tag
        let col_idx = 1
        let tag = ''

        do {
            //no entry
            if (typeof element[col_idx] === 'undefined') {
                col_idx++
                continue
            }
            //empty entry
            if (element[col_idx].trim().length == 0) {
                col_idx++
                continue
            }
            //tag
            if (element[col_idx].trim().startsWith('{') || element[col_idx].trim().endsWith('}')) {
                tag = element[col_idx].trim().replace('{', '').replace('}', '')
                //log(tag)
                break
            }
            //some other text
            col_idx++
        } while (col_idx <= 17)

        if (col_idx == 18 && tag == '') {
            //empty line or does not contain any tag
            //log(chalk.bgRed.white('Empty row'))
            return
        }

        log(''.padStart(col_idx - 2, '\t'), chalk.blueBright(tag), '\t', element[cardinality] ? element[cardinality] : '')

    });

}

//detect elemets structure only the 1st level
//root -> child elements
function detect_structure(sph) {
    var xlData = XLSX.utils.sheet_to_json(sph)
    var parent = null, parent_col = 0
    let cardinality = 1
    xlData.forEach(element => {

        if (Object.values(element).indexOf('Cardinality') != -1) {
            cardinality = Object.keys(element)[Object.values(element).indexOf('Cardinality')]
            //log(cardinality, element[cardinality])
        }
        //get the tag
        let col_idx = 1
        let tag = ''

        do {
            //no entry
            if (typeof element[col_idx] === 'undefined') {
                col_idx++
                continue
            }
            //empty entry
            if (element[col_idx].trim().length == 0) {
                col_idx++
                continue
            }
            //tag
            //open tag that may contain sub tags
            if ((element[col_idx].trim().startsWith('{') && !element[col_idx].trim().endsWith('}'))) {
                tag = element[col_idx].trim().replace('{', '')
                //log(tag)
                if (!Object.hasOwn(element_children, tag)) element_children[tag] = []
                if (parent && parent_col < col_idx &&
                    element_children[parent].indexOf(`${tag}  ${element[cardinality] ? element[cardinality] : '?!?'}`) == -1) element_children[parent].push(`${tag}  ${element[cardinality] ? element[cardinality] : '?!?'}`)
                parent = tag
                parent_col = col_idx

                if (tag != 'CRITERION' && (!element[cardinality] || (element[cardinality] && `${element[cardinality]}`.trim() == ''))) log(`No cardinality ${parent}:${tag} __ ${typeof element[cardinality]}`)
                break
            }
            //one line tag - most probably the leaf
            if ((element[col_idx].trim().startsWith('{') && element[col_idx].trim().endsWith('}'))) {
                tag = element[col_idx].trim().replace('{', '').replace('}', '')
                //log(tag)
                //if (typeof element_children[tag] === 'undefined') element_children[tag] = []
                if (parent && element_children[parent].indexOf(`${tag}  ${element[cardinality] ? element[cardinality] : '?!?'}`) == -1) element_children[parent].push(`${tag}  ${element[cardinality] ? element[cardinality] : '?!?'}`)

                if (!element[cardinality] || (element[cardinality] && `${element[cardinality]}`.trim() == '')) log(`No cardinality ${parent}:${tag} __ ${typeof element[cardinality]}`)
            }

            //some other text
            col_idx++
        } while (col_idx <= 17)

        if (col_idx == 18 && tag == '') {
            //empty line or does not contain any tag
            //log(chalk.bgRed.white('Empty row'))
            return
        }
    });
}

//dump Excel to JSON
function all_JSON(sph) {
    var xlData = XLSX.utils.sheet_to_json(sph)
    log(xlData)
}

//auxiliary function to write ESPD Request and Response XML to a file
function writeXMLfiles() {
    espd_request.doc()
    fs.writeFile('ESPD_Request.xml', espd_request.end({ prettyPrint: true }), (err) => {
        if (err) {
            log('Error writing to file:', err);
        } else {
            log(`JSON data written to ESPD_Request.xml`);
        }
    });

    espd_response.doc()
    fs.writeFile('ESPD_Response.xml', espd_response.end({ prettyPrint: true }), (err) => {
        if (err) {
            log('Error writing to file:', err);
        } else {
            log(`JSON data written to ESPD_Response.xml`);
        }
    });
}

//Generate Request header
function createRootElements() {
    espd_request.com(` The ESPD-EDM-V${schemeVersionID} is entirely based on OASIS UBL-2.3 `)
        .ele('@cbc', 'UBLVersionID', { 'schemeAgencyID': 'OASIS-UBL-TC' }).txt('2.3').up()
        .com(` How ESPD-EDM-V${schemeVersionID} uses the UBL-2.3 schemas whilst keeping conformance `)
        .ele('@cbc', 'ProfileExecutionID', { 'schemeAgencyID': "OP", 'schemeVersionID': schemeVersionID }).txt(`ESPD-EDMv${schemeVersionID}`).up()
        .com(' The identifier of this document is generally generated by the systems that creates the ESPD ')
        .ele('@cbc', 'ID', { 'schemeAgencyID': 'DGPE' }).txt(`ESPDREQ-DGPE-${uuid_v4.randomUUID()}`).up()
        .com(' Indicates whether this document is an original or a copy. In this case the document is the original ')
        .ele('@cbc', 'CopyIndicator').txt('false').up()
        .com(' The unique identifier for this instance of the document. Copies of this document should have different UUIDs ')
        .ele('@cbc', 'UUID', { 'schemeID': 'ISO/IEC 9834-8:2008 - 4UUID', 'schemeAgencyID': 'XXXESPD-SERVICEXXX', 'schemeVersionID': schemeVersionID }).txt(uuid_v4.randomUUID()).up()
        .com(' The reference number the contracting authority assigns to this procurement procedure ')
        .ele('@cbc', 'ContractFolderID', { 'schemeAgencyID': 'DGPE' }).txt('PP.20170419.1024-9').up()
        .ele('@cbc', 'IssueDate').txt((new Date()).toISOString().substring(0, 10)).up()
        .ele('@cbc', 'IssueTime').txt((new Date()).toTimeString().substring(0, 8) + (new Date()).toTimeString().substring(12, 15) + ":" + (new Date()).toTimeString().substring(15, 17)).up()
        .com(' The version of the content of this document. If the document is modified the element cbc:PreviousVersionID should be instantiated ')
        .ele('@cbc', 'VersionID', { 'schemeAgencyID': 'OP', 'schemeVersionID': schemeVersionID }).txt(schemeVersionID).up()
        .com(' The type of the procurement procedure; this information is provided by eForms and the concret notice per procedure. e.g. open = 	In open procedures any interested economic operator may submit a tender in response to a call for competition. ')
        .ele('@cbc', 'ProcedureCode', { "listID": "Dummy_procurement-procedure-type", "listAgencyID": "OP", "listVersionID": "yyyymmdd-0" }).txt('Open').up()


    espd_response.com(` The ESPD-EDM-V${schemeVersionID} is entirely based on OASIS UBL-2.3 `)
        .ele('@cbc', 'UBLVersionID', { 'schemeAgencyID': "OASIS-UBL-TC" }).txt('2.3').up()
        .com(` How ESPD-EDM-V${schemeVersionID} uses the UBL-2.3 schemas whilst keeping conformance `)
        .ele('@cbc', 'ProfileExecutionID', { 'schemeAgencyID': "OP", 'schemeVersionID': schemeVersionID }).txt(`ESPD-EDMv${schemeVersionID}`).up()
        .com(` The identifier of this document	generally generated by the systems that creates the ESPD `)
        .ele('@cbc', 'ID', { 'schemeAgencyID': 'DGPE' }).txt(`ESPDREQ-DGPE-${uuid_v4.randomUUID()}`).up()
        .com(' Indicates whether this document is an original or a copy. In this case the document is the original ')
        .ele('@cbc', 'CopyIndicator').txt('false').up()
        .com(' The unique identifier for this instance of the document. Copies of this document should have different UUIDs ')
        .ele('@cbc', 'UUID', { 'schemeID': 'ISO/IEC 9834-8:2008 - 4UUID', 'schemeAgencyID': 'XXXESPD-SERVICEXXX', 'schemeVersionID': schemeVersionID }).txt(uuid_v4.randomUUID()).up()
        .com(' The reference number the contracting authority assigns to this procurement procedure ')
        .ele('@cbc', 'ContractFolderID', { 'schemeAgencyID': 'DGPE' }).txt('PP.20170419.1024-9').up()
        .ele('@cbc', 'IssueDate').txt((new Date()).toISOString().substring(0, 10)).up()
        .ele('@cbc', 'IssueTime').txt((new Date()).toTimeString().substring(0, 8) + (new Date()).toTimeString().substring(12, 15) + ":" + (new Date()).toTimeString().substring(15, 17)).up()
        .com(' The version of the content of this document. If the document is modified the element cbc:PreviousVersionID should be instantiated ')
        .ele('@cbc', 'VersionID', { 'schemeAgencyID': 'OP', 'schemeVersionID': schemeVersionID }).txt(schemeVersionID).up()
        .com(' The type of the procurement procedure; this information is provided by eForms and the concret notice per procedure. e.g. open = 	In open procedures any interested economic operator may submit a tender in response to a call for competition. ')
        .ele('@cbc', 'ProcedureCode', { "listID": "Dummy_procurement-procedure-type", "listAgencyID": "OP", "listVersionID": "yyyymmdd-0" }).txt('Open').up()

    createContractingAuthority()


}

//Generate Request Contracting Authority
function createContractingAuthority() {

    espd_request.ele('@cac', 'ContractingParty')
        .ele('@cbc', 'BuyerProfileURI').txt('DV').up()
        .ele('@cac', 'Party')
        .ele('@cbc', 'WebsiteURI').txt('DV').up()
        .ele('@cbc', 'EndpointID', { 'schemeID': 'DV', 'schemeAgencyID': 'OP' }).txt('DV').up()
        .ele('@cac', 'PartyIdentification')
        .ele('@cbc', 'ID', { 'schemeAgencyID': "VIES" }).txt('B82387770').up()
        .up()
        .ele('@cac', 'PartyName')
        .ele('@cbc', 'Name').txt('DV').up()
        .up()
        .ele('@cac', 'PostalAddress')
        .ele('@cbc', 'StreetName').txt('DV').up()
        .ele('@cbc', 'CityName').txt('DV').up()
        .ele('@cbc', 'PostalZone').txt('DV').up()
        .ele('@cac', 'Country')
        .ele('@cbc', 'IdentificationCode', { 'listID': "http://publications.europa.eu/resource/authority/country", 'listAgencyID': "ISO", 'listVersionID': "20220928-0" }).txt('BEL').up()
        .up()
        .up()
        .ele('@cac', 'Contact')
        .ele('@cbc', 'Name').txt('DV').up()
        .ele('@cbc', 'Telephone').txt('DV').up()
        .ele('@cbc', 'ElectronicMail').txt('DV').up()
        .up()
        .up()
        .up()

    espd_response.ele('@cac', 'ContractingParty')
        .ele('@cbc', 'BuyerProfileURI').txt('DV').up()
        .ele('@cac', 'Party')
        .ele('@cbc', 'WebsiteURI').txt('DV').up()
        .ele('@cbc', 'EndpointID', { 'schemeID': 'DV', 'schemeAgencyID': 'OP' }).txt('DV').up()
        .ele('@cac', 'PartyIdentification')
        .ele('@cbc', 'ID', { 'schemeAgencyID': "VIES" }).txt('B82387770').up()
        .up()
        .ele('@cac', 'PartyName')
        .ele('@cbc', 'Name').txt('DV').up()
        .up()
        .ele('@cac', 'PostalAddress')
        .ele('@cbc', 'StreetName').txt('DV').up()
        .ele('@cbc', 'CityName').txt('DV').up()
        .ele('@cbc', 'PostalZone').txt('DV').up()
        .ele('@cac', 'Country')
        .ele('@cbc', 'IdentificationCode', { 'listID': "http://publications.europa.eu/resource/authority/country", 'listAgencyID': "ISO", 'listVersionID': "20220928-0" }).txt('BEL').up()
        .up()
        .up()
        .ele('@cac', 'Contact')
        .ele('@cbc', 'Name').txt('DV').up()
        .ele('@cbc', 'Telephone').txt('DV').up()
        .ele('@cbc', 'ElectronicMail').txt('DV').up()
        .up()
        .up()
        .up()

    //add the Economic Operator for the Response
    espd_response.ele('@cac', 'EconomicOperatorParty')
        .ele('@cac', 'EconomicOperatorRole')
        .ele('@cbc', 'RoleCode', { 'listID': "http://publications.europa.eu/resource/authority/eo-role-type", 'listAgencyID': "OP", 'listVersionID': "20211208-0" }).txt('group-mem').up()
        .up()
        .ele('@cac', 'Party')
        .ele('@cbc', 'WebsiteURI').txt('https://www.ProcurerWebsite.eu').up()
        .ele('@cbc', 'IndustryClassificationCode', { 'listID': "http://publications.europa.eu/resource/authority/economic-operator-size", 'listAgencyID': "OP", 'listVersionID': "20220316-0" }).txt('sme').up()
        .ele('@cac', 'PartyIdentification')
        .ele('@cbc', 'ID', { 'schemeAgencyID': "OP" }).txt('AD123456789').up()
        .up()
        .ele('@cac', 'PartyName')
        .ele('@cbc', 'Name').txt('__Procurer Official Name__').up()
        .up()
        .ele('@cac', 'PostalAddress')
        .ele('@cbc', 'StreetName').txt('__ProcurerStreet__').up()
        .ele('@cbc', 'CityName').txt('__ProcurerCity__').up()
        .ele('@cbc', 'PostalZone').txt('12345').up()
        .ele('@cac', 'Country')
        .ele('@cbc', 'IdentificationCode', { 'listID': "http://publications.europa.eu/resource/authority/country", 'listAgencyID': "ISO", 'listName': "country", 'listVersionID': "20220928-0" }).txt('BEL').up()
        .up()
        .up()
        .ele('@cac', 'Contact')
        .ele('@cbc', 'Name').txt('__ProcurerContactName__').up()
        .ele('@cbc', 'Telephone').txt('654321').up()
        .ele('@cbc', 'Telefax').txt('098765').up()
        .ele('@cbc', 'ElectronicMail').txt('__ProcurerContact@gov.eu').up()
        .up()
        .up()
        .up()

    createProcurementProject()
}

//Generate Request Procurement Project
function createProcurementProject() {
    espd_request.ele('@cac', 'ProcurementProject')
        .ele('@cbc', 'Description').txt('Description of Project.').up()
        .up()

    //Procurement Projet and Prourement Project Lot
    espd_response.ele('@cac', 'ProcurementProject')
        .ele('@cbc', 'Description').txt('Description of Project.').up()
        .up()

    espd_response.ele('@cac', 'ProcurementProjectLot')
        .ele('@cbc', 'ID', { 'schemeID': "Criterion", 'schemeAgencyID': "OP", 'schemeVersionID': schemeVersionID }).txt('LOT-0000').up()
        .up()


}

//create Evidence for ESPD Response
function createEvidence() {
    evidence_ids.forEach((evid) => {
        espd_response.ele('@cac', 'Evidence')
        .ele('@cbc', 'ID', { 'schemeAgencyID': "XXXAGENCYXXX" }).txt(evid).up()
        .ele('@cbc', 'ConfidentialityLevelCode', { 'listID': "http://publications.europa.eu/resource/authority/access-right", 'listAgencyID': "OP", 'listVersionID': "20220316-0" }).txt('CONFIDENTIAL').up()
        .ele('@cac', 'DocumentReference')
        .ele('@cbc', 'ID', { 'schemeAgencyID': "XXXAGENCYXXX" }).txt('SAT-11121233').up()
        .ele('@cac', 'Attachment')
        .ele('@cac', 'ExternalReference')
        .ele('@cbc', 'URI').txt('http:dod.gov.usa/sat/it/soft/prk?id=11121233').up()
        .up().up()
        .ele('@cac', 'IssuerParty')
        .ele('@cac', 'PartyIdentification')
        .ele('@cbc', 'ID', { 'schemeAgencyID': "XXXAGENCYXXX" }).txt('XXXXXXXX').up()
        .up()
        .ele('@cac', 'PartyName')
        .ele('@cbc', 'Name').txt('USA DoD').up()
        .up()
        .up()
        .up()
        .up()
    })
}

//render the elementes of JSON to XML ESPD Request, and ESPD Response - the Request part
function render_request(obj, part = espd_request, EG_FLAG = true) {
    let tmp = part
    for (const elm in obj) {

        if (Object.hasOwn(obj, elm)) {
            const element = obj[elm]
            switch (element.type) {
                case "CRITERION":
                    let c_id = (element.requestpath.indexOf('_OT_') != -1)?element.requestpath:element.elementUUID
                    tmp = part.com(` Criterion: ${element.name} `)
                        .ele('@cac', 'TenderingCriterion')
                        .ele('@cbc', 'ID', { 'schemeID': 'Criterion', 'schemeAgencyID': 'OP', 'schemeVersionID': schemeVersionID }).txt(c_id).up()
                        .ele('@cbc', 'CriterionTypeCode', { 'listID': "http://publications.europa.eu/resource/authority/criterion", 'listAgencyID': "OP", 'listVersionID': "20230315-0" }).txt(element.elementcode).up()
                        .ele('@cbc', 'Name').txt(element.name).up()
                        .ele('@cbc', 'Description').txt(element.description).up()
                        
                    //add lot for SC only
                    if(element.tag.endsWith('- SC')){ 
                        tmp = tmp.ele('@cac', 'ProcurementProjectLotReference')
                              .ele('@cbc', 'ID', { 'schemeID': "Criterion", 'schemeAgencyID': "OP", 'schemeVersionID': schemeVersionID }).txt('LOT-0000').up()
                              .up()
                    }
                    //create the inner elements
                    if (Object.hasOwn(element, 'components')) render_request(element.components, tmp, element.tag.endsWith('- EG'))
                    part.up()

                    break;
                case "SUBCRITERION":
                    tmp = part.ele('@cac', 'SubTenderingCriterion')
                        .ele('@cbc', 'ID', { 'schemeID': 'Criterion', 'schemeAgencyID': 'OP', 'schemeVersionID': schemeVersionID }).txt(element.requestpath).up()
                        .ele('@cbc', 'Name').txt(element.name).up()
                        .ele('@cbc', 'Description').txt(element.description).up()
                    //create the inner elements
                    if (Object.hasOwn(element, 'components')) render_request(element.components, tmp, EG_FLAG)
                    part.up()
                    break;
                case "LEGISLATION":
                    tmp = part.ele('@cac', 'Legislation')
                        .ele('@cbc', 'ID', { 'schemeID': 'Criterion', 'schemeAgencyID': 'OP', 'schemeVersionID': schemeVersionID }).txt(element.requestpath).up()
                        .ele('@cbc', 'Title').txt('[Legislation Title]').up()
                        .ele('@cbc', 'Description').txt('[Legislation Description]').up()
                        .ele('@cbc', 'JurisdictionLevel').txt('EU').up()
                        .ele('@cbc', 'Article').txt('[Article, e.g. Article 2.I.a]').up()
                        .ele('@cbc', 'URI').txt('http://eur-lex.europa.eu/').up()
                        .ele('@cac', 'Language')
                        .ele('@cbc', 'LocaleCode', { 'listID': "http://publications.europa.eu/resource/authority/language", 'listAgencyID': "ISO", 'listVersionID': "20220928-0" }).txt('ENG').up()
                        .up()
                        .up()
                    //create the inner elements
                    if (Object.hasOwn(element, 'components')) render_request(element.components, tmp, EG_FLAG)
                    part.up()
                    break;
                case "ADDITIONAL_DESCRIPTION_LINE":
                    tmp = part.ele('@cbc', 'Description').txt(element.description).up()
                    //create the inner elements
                    if (Object.hasOwn(element, 'components')) render_request(element.components, tmp, EG_FLAG)
                    part.up()
                    break;
                case "REQUIREMENT_GROUP": case "QUESTION_GROUP":
                    //render only 1st occurence in Request
                    if (Object.hasOwn(element, 'cardinality') && typeof element.cardinality === 'string') {
                        //log(element.cardinality, typeof element.cardinality)              
                        if (element.cardinality.indexOf("(2)") != -1 ||
                            element.cardinality.indexOf("(3)") != -1 ||
                            element.cardinality.indexOf("(4)") != -1)
                            break;
                    }
                    tmp = part.ele('@cac', 'TenderingCriterionPropertyGroup')
                        .ele('@cbc', 'ID', { 'schemeID': 'Criterion', 'schemeAgencyID': 'OP', 'schemeVersionID': schemeVersionID }).txt(element.requestpath).up()
                        .ele('@cbc', 'PropertyGroupTypeCode', { 'listID': "property-group-type", 'listAgencyID': "OP", 'listVersionID': schemeVersionID }).txt(element.elementcode).up()

                    //create the inner elements
                    if (Object.hasOwn(element, 'components')) render_request(element.components, tmp, EG_FLAG)
                    part.up()
                    break;
                case "REQUIREMENT_SUBGROUP": case "QUESTION_SUBGROUP":
                    //render only 1st occurence in Request
                    if (Object.hasOwn(element, 'cardinality') && typeof element.cardinality === 'string') {
                        //log(element.cardinality, typeof element.cardinality)
                        if (element.cardinality.indexOf("(2)") != -1 ||
                            element.cardinality.indexOf("(3)") != -1 ||
                            element.cardinality.indexOf("(4)") != -1)
                            break;
                    }
                    tmp = part.ele('@cac', 'SubsidiaryTenderingCriterionPropertyGroup')
                        .ele('@cbc', 'ID', { 'schemeID': 'Criterion', 'schemeAgencyID': 'OP', 'schemeVersionID': schemeVersionID }).txt(element.requestpath).up()
                        .ele('@cbc', 'PropertyGroupTypeCode', { 'listID': "property-group-type", 'listAgencyID': "OP", 'listVersionID': schemeVersionID }).txt(element.elementcode).up()

                    //create the inner elements
                    if (Object.hasOwn(element, 'components')) render_request(element.components, tmp, EG_FLAG)
                    part.up()
                    break;
                case "QUESTION": case "CAPTION":
                    part.ele('@cac', 'TenderingCriterionProperty')
                        .ele('@cbc', 'ID', { 'schemeID': 'Criterion', 'schemeAgencyID': 'OP', 'schemeVersionID': schemeVersionID }).txt(element.requestpath).up()
                        .ele('@cbc', 'Name').txt(element.name).up()
                        .ele('@cbc', 'Description').txt(element.description).up()
                        .ele('@cbc', 'TypeCode', { 'listID': "criterion-element-type", 'listAgencyID': "OP", 'listVersionID': schemeVersionID }).txt(element.type).up()
                        .ele('@cbc', 'ValueDataTypeCode', { 'listID': "response-data-type", 'listAgencyID': "OP", 'listVersionID': schemeVersionID }).txt(Object.hasOwn(element, 'propertydatatype') ? element.propertydatatype : 'NONE').up()
                        .up()
                    break;
                case "REQUIREMENT":
                    tmp = part.ele('@cac', 'TenderingCriterionProperty')
                        .ele('@cbc', 'ID', { 'schemeID': 'Criterion', 'schemeAgencyID': 'OP', 'schemeVersionID': schemeVersionID }).txt(element.requestpath).up()
                        .ele('@cbc', 'Name').txt(element.name).up()
                        .ele('@cbc', 'Description').txt(element.description).up()
                        .ele('@cbc', 'TypeCode', { 'listID': "criterion-element-type", 'listAgencyID': "OP", 'listVersionID': schemeVersionID }).txt(element.type).up()
                        .ele('@cbc', 'ValueDataTypeCode', { 'listID': "response-data-type", 'listAgencyID': "OP", 'listVersionID': schemeVersionID }).txt(Object.hasOwn(element, 'propertydatatype') ? element.propertydatatype : 'NONE').up()
                        .com(' No answer is expected here from the economic operator, as this is a REQUIREMENT issued by the contracting authority. Hence the element "cbc:ValueDataTypeCode" contains the type of value of the requirement issued by the contracting authority  ')

                    switch (element.propertydatatype) {
                        case 'AMOUNT':
                            tmp.ele('@cbc', 'ExpectedAmount', { 'currencyID': 'EUR' }).txt(element.sellervalue ? element.sellervalue : 0).up()
                            break;
                        case 'IDENTIFIER': case "EVIDENCE_IDENTIFIER": case "ECONOMIC_OPERATOR_IDENTIFIER": case "LOT_IDENTIFIER":
                            tmp.ele('@cbc', 'ExpectedID', { 'schemeAgencyID': 'OP' }).txt(element.sellervalue).up()
                            break;
                        case 'CODE_BOOLEAN':
                            tmp.ele('@cbc', 'ExpectedCode', { 'listID': 'boolean-gui-control-type', 'listAgencyID': 'OP', 'listVersionID': schemeVersionID }).txt(element.sellervalue).up()
                            break;
                        case 'CODE_COUNTRY':
                            tmp.ele('@cbc', 'ExpectedCode', { 'listID': "http://publications.europa.eu/resource/authority/country", 'listName': "country", 'listAgencyID': "ISO", 'listVersionID': "20220928-0" }).txt(element.sellervalue).up()
                            break;
                        case 'ECONOMIC_OPERATOR_ROLE_CODE':
                            tmp.ele('@cbc', 'ExpectedCode', { 'listID': "http://publications.europa.eu/resource/authority/eo-role-type", 'listAgencyID': "OP", 'listVersionID': "20211208-0" }).txt(element.sellervalue).up()
                            break;
                        case 'DESCRIPTION':
                            tmp.ele('@cbc', 'ExpectedDescription').txt(element.sellervalue).up()
                            break;
                        case 'PERCENTAGE':
                            tmp.ele('@cbc', 'ValueUnitCode').txt('PERCENTAGE').up()
                                .ele('@cbc', 'ExpectedValueNumeric').txt(element.sellervalue ? element.sellervalue : 0).up()
                            break;
                        case 'DATE': case 'PERIOD':
                            tmp.ele('@cac', 'ApplicablePeriod')
                                .ele('@cbc', 'StartDate').txt(element.sellervalue ? element.sellervalue : '2000-01-01').up()
                                .ele('@cbc', 'EndDate').txt(element.sellervalue ? element.sellervalue : '2000-12-31').up()
                                .up()
                            break;
                        case 'QUANTITY_INTEGER': case 'QUANTITY_YEAR': case 'QUANTITY':
                            tmp.ele('@cbc', 'ExpectedValueNumeric').txt(element.sellervalue ? element.sellervalue : 0).up()
                            break;
                        case 'MAXIMUM_AMOUNT':
                            tmp.ele('@cbc', 'MaximumAmount', { 'currencyID': 'EUR' }).txt(element.sellervalue ? element.sellervalue : 0).up()
                            break;
                        case 'MINIMUM_AMOUNT':
                            tmp.ele('@cbc', 'MinimumAmount', { 'currencyID': 'EUR' }).txt(element.sellervalue ? element.sellervalue : 0).up()
                            break;
                        case 'MAXIMUM_VALUE_NUMERIC':
                            tmp.ele('@cbc', 'MaximumValueNumeric').txt(element.sellervalue).up()
                            break;
                        case 'MINIMUM_VALUE_NUMERIC':
                            tmp.ele('@cbc', 'MinimumValuenumeric').txt(element.sellervalue).up()
                            break;
                        case 'TRANSLATION_TYPE_CODE':
                            tmp.ele('@cbc', 'TranslationTypeCode').txt(element.sellervalue).up()
                            break;
                        case 'COPY_QUALITY_TYPE_CODE':
                            tmp.ele('@cbc', 'CopyQualityTypeCode').txt(element.sellervalue).up()
                            break;
                        case 'CERTIFICATION_LEVEL_DESCRIPTION':
                            tmp.ele('@cbc', 'CertificationLevelDescription').txt(element.sellervalue).up()
                            break;

                        case 'CODE':
                            if (element.codelist == 'Occupation') tmp.ele('@cbc', 'ExpectedCode', { 'listID': "http://publications.europa.eu/resource/authority/occupation", 'listAgencyID': "EMPL", 'listVersionID': "20221214-0" }).txt(element.sellervalue).up()
                            if (element.codelist == 'FinancialRatioType') tmp.ele('@cbc', 'ExpectedCode', { 'listID': "financial-ratio-type", 'listAgencyID': "OP", 'listVersionID': schemeVersionID }).txt(element.sellervalue).up()
                            if (element.codelist == 'EORoleType') tmp.ele('@cbc', 'ExpectedCode', { 'listID': "http://publications.europa.eu/resource/authority/eo-role-type", 'listAgencyID': "OP", 'listVersionID': "20211208-0" }).txt(element.sellervalue).up()
                            break;

                        default:
                            tmp.com(' PropertyDataType not defined')
                            break;
                    }

                    part.up()
                    break;
                default:
                    part.com(` Unkown ${element.type} - UBL mapping not implemented `).up()
                    break;
            }
        }
    }
}

//render the elements of JSON to XML ESPD Response
/**
 * 
 * @param {JSON} obj 
 * @param {JSON} part 
 */
function render_response(obj, part = espd_response, crt_criterion = 'NONE') {
    let tmp = part

    for (const elm in obj) {
        if (Object.hasOwn(obj, elm)) {
            const element = obj[elm];

            switch (element.type) {
                case 'CRITERION':
                    //create the inner elements
                    if (Object.hasOwn(element, 'components')) render_response(element.components, tmp, element.name)
                    break;
                case "QUESTION_GROUP": case "QUESTION_SUBGROUP":
                    //check for QUESTIONS that are INDICATOR and render only the components that are ON*,
                    //and ONTRUE or ONFALSE depending on the value of the INDICATOR
                    let tmpComponents = {}, QI_FLAG = false, INDICATOR_value = null;
                    if (Object.hasOwn(element, 'components')) {
                        for (const key in element.components) {
                            if (Object.hasOwn(element.components, key)) {
                                const e = element.components[key]
                                tmpComponents[key] = e
                                if (e.type == 'QUESTION' && e.propertydatatype == 'INDICATOR' && Object.hasOwn(e, "sellervalue")) {
                                    QI_FLAG = true
                                    INDICATOR_value = e.sellervalue
                                }
                            }
                        }
                        if (QI_FLAG) {
                            for (const cmp in tmpComponents) {
                                if (Object.hasOwn(tmpComponents, cmp)) {
                                    const c = tmpComponents[cmp]
                                    if (['QUESTION_GROUP', 'QUESTION_SUBGROUP'].indexOf(c.type) != -1) {
                                        if ((c.elementcode == 'ONTRUE' && INDICATOR_value == 'false') ||
                                            (c.elementcode == 'ONFALSE' && INDICATOR_value == 'true')) {
                                            delete tmpComponents[cmp]
                                        }
                                    }
                                }
                            }
                        }
                        render_response(tmpComponents, part, crt_criterion)
                    }

                    break;
                case "REQUIREMENT_GROUP":
                case "REQUIREMENT_SUBGROUP":
                case 'SUBCRITERION':
                case 'LEGISLATION': case 'ADDITIONAL_DESCRIPTION_LINE':
                case 'REQUIREMENT': case 'CAPTION':
                    //create the inner elements
                    if (Object.hasOwn(element, 'components')) render_response(element.components, tmp, crt_criterion)
                    break;
                case 'QUESTION':
                    tmp = part.com(`  Answer to Criterion:${crt_criterion}  `)
                        .com(` Property: ${element.description} (PropertyID: ${element.responsepath}) `)
                        .ele('@cac', 'TenderingCriterionResponse')
                        .ele('@cbc', 'ID', { 'schemeID': "Criterion", 'schemeAgencyID': "XXXESPD-SERVICEXXX", 'schemeVersionID': schemeVersionID }).txt(element.responsecontent1).up()
                        .ele('@cbc', 'ValidatedCriterionPropertyID', { 'schemeID': "Criterion", 'schemeAgencyID': "XXXESPD-SERVICEXXX", 'schemeVersionID': schemeVersionID }).txt(element.responsecontent2).up()

                    switch (element.propertydatatype) {
                        case 'PERIOD':
                            tmp.ele('@cac', 'ApplicablePeriod')
                                .ele('@cbc', 'StartDate').txt('2017-01-01').up()
                                .ele('@cbc', 'EndDate').txt('2017-12-12').up()
                                .up()
                            break;
                        case 'EVIDENCE_IDENTIFIER':
                            tmp.ele('@cac', 'EvidenceSupplied')
                                .ele('@cbc', 'ID', { 'schemeAgencyID': 'OP' }).txt(element.responsecontent3).up()
                                .up()
                            evidence_ids.push(element.responsecontent3)
                            break;
                        case 'DESCRIPTION':
                            tmp.ele('@cac', 'ResponseValue')
                                .ele('@cbc', 'ID', { 'schemeID': "Criterion", 'schemeAgencyID': "XXXESPD-SERVICEXXX", 'schemeVersionID': schemeVersionID }).txt(element.responsecontent3).up()
                                .ele('@cbc', 'Description').txt(element.sellervalue ? element.sellervalue : 'Dummy Description').up()
                                .up()
                            break;
                        case 'INDICATOR':
                            tmp.ele('@cac', 'ResponseValue')
                                .ele('@cbc', 'ID', { 'schemeID': "Criterion", 'schemeAgencyID': "XXXESPD-SERVICEXXX", 'schemeVersionID': schemeVersionID }).txt(element.responsecontent3).up()
                                .ele('@cbc', 'ResponseIndicator').txt('true').up()
                                .up()
                            break;
                        case 'IDENTFIER':
                            tmp.ele('@cac', 'ResponseValue')
                                .ele('@cbc', 'ID', { 'schemeID': "Criterion", 'schemeAgencyID': "XXXESPD-SERVICEXXX", 'schemeVersionID': schemeVersionID }).txt(element.responsecontent3).up()
                                .ele('@cbc', 'ResponseID', { 'schemeAgencyID': 'OP' }).txt(element.sellervalue ? element.sellervalue : 'Dummy ID').up()
                                .up()
                            break;
                        case 'ECONOMIC_OPERATOR_IDENTIFIER':
                            tmp.ele('@cac', 'ResponseValue')
                                .ele('@cbc', 'ID', { 'schemeID': "Criterion", 'schemeAgencyID': "XXXESPD-SERVICEXXX", 'schemeVersionID': schemeVersionID }).txt(element.responsecontent3).up()
                                .ele('@cbc', 'ResponseID', { 'schemeAgencyID': 'XXXEOIDXXX' }).txt(element.sellervalue ? element.sellervalue : 'Dummy EO_ID').up()
                                .up()
                            break;
                        case 'QUAL_IDENTIFIER':
                            tmp.ele('@cac', 'ResponseValue')
                                .ele('@cbc', 'ID', { 'schemeID': "Criterion", 'schemeAgencyID': "XXXESPD-SERVICEXXX", 'schemeVersionID': schemeVersionID }).txt(element.responsecontent3).up()
                                .ele('@cbc', 'ResponseID', { 'schemeAgencyID': 'XXXQUALIDXXX' }).txt(element.sellervalue ? element.sellervalue : 'Dummy QUAL_ID').up()
                                .up()
                            break;
                        case 'URL':
                            tmp.ele('@cac', 'ResponseValue')
                                .ele('@cbc', 'ID', { 'schemeID': "Criterion", 'schemeAgencyID': "XXXESPD-SERVICEXXX", 'schemeVersionID': schemeVersionID }).txt(element.responsecontent3).up()
                                .ele('@cbc', 'ResponseURI').txt(element.sellervalue ? element.sellervalue : 'www.no-such-site.eu').up()
                                .up()
                            break;
                        case 'AMOUNT':
                            tmp.ele('@cac', 'ResponseValue')
                                .ele('@cbc', 'ID', { 'schemeID': "Criterion", 'schemeAgencyID': "XXXESPD-SERVICEXXX", 'schemeVersionID': schemeVersionID }).txt(element.responsecontent3).up()
                                .ele('@cbc', 'ResponseAmount', { 'currencyID': 'EUR' }).txt(1000000000).up()
                                .up()
                            break;
                        case 'PERCENTAGE':
                            tmp.ele('@cac', 'ResponseValue')
                                .ele('@cbc', 'ID', { 'schemeID': "Criterion", 'schemeAgencyID': "XXXESPD-SERVICEXXX", 'schemeVersionID': schemeVersionID }).txt(element.responsecontent3).up()
                                .ele('@cbc', 'ResponseNumeric', { 'format': 'PERCENTAGE' }).txt(element.sellervalue ? element.sellervalue : 3.14).up()
                                .up()
                            break;
                        case 'QUANTITY_INTEGER':
                            tmp.ele('@cac', 'ResponseValue')
                                .ele('@cbc', 'ID', { 'schemeID': "Criterion", 'schemeAgencyID': "XXXESPD-SERVICEXXX", 'schemeVersionID': schemeVersionID }).txt(element.responsecontent3).up()
                                .ele('@cbc', 'ResponseQuantity', { 'unitCode': 'INTEGER' }).txt(element.sellervalue ? element.sellervalue : 42).up()
                                .up()
                            break;
                        case 'QUANTITY_YEAR':
                            tmp.ele('@cac', 'ResponseValue')
                                .ele('@cbc', 'ID', { 'schemeID': "Criterion", 'schemeAgencyID': "XXXESPD-SERVICEXXX", 'schemeVersionID': schemeVersionID }).txt(element.responsecontent3).up()
                                .ele('@cbc', 'ResponseQuantity', { 'unitCode': 'YEAR' }).txt(element.sellervalue ? element.sellervalue : 2000).up()
                                .up()
                            break;
                        case 'QUANTITY':
                            tmp.ele('@cac', 'ResponseValue')
                                .ele('@cbc', 'ID', { 'schemeID': "Criterion", 'schemeAgencyID': "XXXESPD-SERVICEXXX", 'schemeVersionID': schemeVersionID }).txt(element.responsecontent3).up()
                                .ele('@cbc', 'ResponseQuantity').txt(element.sellervalue ? element.sellervalue : 60).up()
                                .up()
                            break;
                        case 'DATE':
                            tmp.ele('@cac', 'ResponseValue')
                                .ele('@cbc', 'ID', { 'schemeID': "Criterion", 'schemeAgencyID': "XXXESPD-SERVICEXXX", 'schemeVersionID': schemeVersionID }).txt(element.responsecontent3).up()
                                .ele('@cbc', 'ResponseDate').txt('2000-01-01').up()
                                .up()
                            break;
                        case 'TIME':
                            tmp.ele('@cac', 'ResponseValue')
                                .ele('@cbc', 'ID', { 'schemeID': "Criterion", 'schemeAgencyID': "XXXESPD-SERVICEXXX", 'schemeVersionID': schemeVersionID }).txt(element.responsecontent3).up()
                                .ele('@cbc', 'ResponseTime').txt(element.sellervalue ? element.sellervalue : '00:00:00+00:00').up()
                                .up()
                            break;
                        case 'CODE_COUNTRY':
                            tmp.ele('@cac', 'ResponseValue')
                                .ele('@cbc', 'ID', { 'schemeID': "Criterion", 'schemeAgencyID': "XXXESPD-SERVICEXXX", 'schemeVersionID': schemeVersionID }).txt(element.responsecontent3).up()
                                .ele('@cbc', 'ResponseCode', { 'listID': "http://publications.europa.eu/resource/authority/country", 'listName': "country", 'listAgencyID': "ISO", 'listVersionID': "20220928-0" }).txt('BEL').up()
                                .up()
                            break;
                        case 'CODE':
                            if (element.codelist == 'occupation') {
                                tmp.ele('@cac', 'ResponseValue')
                                    .ele('@cbc', 'ID', { 'schemeID': "Criterion", 'schemeAgencyID': "XXXESPD-SERVICEXXX", 'schemeVersionID': schemeVersionID }).txt(element.responsecontent3).up()
                                    .ele('@cbc', 'ResponseCode', { 'listAgencyID': "EMPL", 'listVersionID': "20221214-0", 'listID': "http://publications.europa.eu/resource/authority/occupation" }).txt('dummy-value').up()
                                    .up()
                            } else if (element.codelist == 'FinancialRatioType') {
                                tmp.ele('@cac', 'ResponseValue')
                                    .ele('@cbc', 'ID', { 'schemeID': "Criterion", 'schemeAgencyID': "XXXESPD-SERVICEXXX", 'schemeVersionID': schemeVersionID }).txt(element.responsecontent3).up()
                                    .ele('@cbc', 'ResponseCode', { 'listAgencyID': "OP", 'listVersionID': schemeVersionID, 'listID': "financial-ratio-type" }).txt('dummy-value').up()
                                    .up()
                            } else if (element.codelist == 'EoRoleType') {
                                tmp.ele('@cac', 'ResponseValue')
                                    .ele('@cbc', 'ID', { 'schemeID': "Criterion", 'schemeAgencyID': "XXXESPD-SERVICEXXX", 'schemeVersionID': schemeVersionID }).txt(element.responsecontent3).up()
                                    .ele('@cbc', 'ResponseCode', { 'listAgencyID': "OP", 'listVersionID': "20211208-0", 'listID': "http://publications.europa.eu/resource/authority/eo-role-type" }).txt('dummy-value').up()
                                    .up()
                            }

                            break;
                        default:
                            break;
                    }

                    tmp.up()
                    //part.up()
                    break;

                default:
                    break;
            }
        }
    }
}