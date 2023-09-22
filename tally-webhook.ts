import "dotenv/config";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import fetch from "node-fetch";
import { parse } from "csv-parse/sync";
import { FieldHeader, FileName, Mapping, Record } from "./types.js";
import tallyWebhookMapping from "./tally-webhook-mapping.js";

const sleep = (time: number): Promise<void> => {
  console.log(`sleeping for ${time}ms...`);
  return new Promise((resolve) => setTimeout(resolve, time));
};

const parseExportDate = (date: string): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  } else {
    throw new Error(`"${date}" does not correspond to format yyyy-mm-dd`);
  }
};

const parseFormId = (formId: string): string => {
  if (/^[\d\w]{6}$/.test(formId)) {
    return formId;
  } else {
    throw new Error(
      `Form id should be 6 alphanumerical characters, received: "${formId}"`
    );
  }
};

const parseFileName = (filePath: string): FileName => {
  const fileName = path.basename(filePath, ".csv");

  if (!fileName.includes("Submissions")) {
    throw new Error(
      `cannot parse file name "${fileName}": expected to include "Submissions"`
    );
  }

  const segments = fileName.split("_");

  if (segments[segments.length - 3] === "Submissions") {
    // form id provided
    return {
      formName: segments.slice(0, -3).join(" "),
      formId: parseFormId(segments[segments.length - 1]),
      exportDate: parseExportDate(segments[segments.length - 2]),
    };
  } else if (segments[segments.length - 2] === "Submissions") {
    // form id not provided
    return {
      formName: segments.slice(0, -2).join(" "),
      formId: null,
      exportDate: parseExportDate(segments[segments.length - 1]),
    };
  } else {
    throw new Error(
      `cannot parse file name "${fileName}": "Submissions" occurs at unexpected position`
    );
  }
};

const generateFieldHeader = (column: string, mapping: Mapping): FieldHeader => {
  if (!Object.hasOwn(mapping, column)) {
    throw new Error(`Mapping does not exist for column "${column}"`);
  }

  return {
    ...mapping[column],
  };
};

const generateMultiValues = (values: string[]) => {
  return {
    options: values.map((value, i) => ({
      id: "fake-id-" + i,
      text: value,
    })),
    value: values.map((_, i) => "fake-id-" + i),
  };
};

const generateField = (header: FieldHeader, rawValue: string) => {
  switch (header.type) {
    case "INPUT_TEXT":
    case "INPUT_EMAIL":
    case "TEXTAREA":
      return {
        ...header,
        value: rawValue.length > 0 ? rawValue : null,
      };
    case "LINEAR_SCALE":
      return {
        ...header,
        value: parseInt(rawValue),
      };
    case "MULTIPLE_CHOICE":
    case "DROPDOWN":
      return {
        ...header,
        ...generateMultiValues([rawValue]),
      };
    case "CHECKBOXES":
      if (header.key.split("_").length >= 3) {
        // individual checkbox
        return {
          ...header,
          value: rawValue === "true" ? true : null,
        };
      } else {
        // list of checkboxes
        const values = rawValue
          .split(",")
          .map((value) => value.trim())
          .filter((value) => value.length > 0);

        if (values.length > 0) {
          return {
            ...header,
            ...generateMultiValues(values),
          };
        } else {
          return {
            ...header,
            value: null,
            options: [],
          };
        }
      }
    default:
      throw new Error(`Cannot generate field of type "${header.type}"`);
  }
};

(async function main() {
  if (!process.env.WEBHOOK_URL) {
    throw new Error("WEBHOOK_URL env var not set");
  }

  const rawCsvPath = process.argv[2];
  if (!rawCsvPath)
    throw new Error(
      "Need to provide path to CSV file, example: ts-node tally-webhook.ts /path/to/file.csv"
    );

  const isDryRun =
    process.argv.filter((arg: string) => arg === "--dry-run" || arg === "-d")
      .length > 0;
  console.log("dry run", isDryRun);

  const resolvedCsvPath = path.resolve(rawCsvPath);
  console.log(resolvedCsvPath);

  const parsedFileName = parseFileName(resolvedCsvPath);
  console.log(parsedFileName);

  const csvBlob = fs.readFileSync(resolvedCsvPath, "utf-8");

  const records: Record[] = parse(csvBlob, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
  });

  for (const record of records) {
    const fields = Object.getOwnPropertyNames(record)
      .filter((column) => Object.hasOwn(tallyWebhookMapping, column))
      .map((column) => {
        const header = generateFieldHeader(column, tallyWebhookMapping);
        return generateField(header, record[column]);
      });

    const requestBody = {
      eventId: crypto.randomUUID(),
      eventType: "FORM_RESPONSE",
      createdAt: new Date().toISOString(),
      data: {
        // NOTE: in all my testing data, responseId and submissionId were the same value
        responseId: record["Submission ID"],
        submissionId: record["Submission ID"],
        respondentId: record["Respondent ID"],
        formId: parsedFileName.formId ?? "UNKNOWN",
        formName: parsedFileName.formName,
        createdAt: record["Submitted at"],
        fields: fields,
      },
    };

    console.dir(requestBody, { depth: null });

    if (isDryRun) {
      console.log(
        `DRY RUN: would make post request to ${process.env.WEBHOOK_URL}`
      );
    } else {
      // TODO https://pipedream.com/docs/components/api/#dedupe-strategies => "id: response.responseId"

      // tally.so/help/webhooks
      // Make POST request to the webhook
      const data = await fetch(process.env.WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log(data);

      await sleep(500);
    }
  }
})();
