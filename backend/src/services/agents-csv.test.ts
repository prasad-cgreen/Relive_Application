import { agentCsvRows } from "@relive/shared";
import { describe, expect, it } from "vitest";

describe("agentCsvRows (admin page CSV upload)", () => {
  it("finds the columns by header, in any order, and cleans up mobile numbers", () => {
    const csv = '﻿City,Mobile Number,Agent Name\r\nPune,+91 98765 00001,Priya Nair\r\nMumbai,098765-00002,"Rao, Asha"\r\n\r\n,,\r\n';
    expect(agentCsvRows(csv)).toEqual([
      { row: 2, name: "Priya Nair", mobile: "9876500001" },
      { row: 3, name: "Rao, Asha", mobile: "9876500002" },
    ]);
  });

  it("without a header: name, then mobile", () => {
    expect(agentCsvRows('Priya Nair,9876500001\nNo Number\n,9876500003\n"Say ""Hi"", Co",9876500004\n')).toEqual([
      { row: 1, name: "Priya Nair", mobile: "9876500001" },
      { row: 2, name: "No Number", mobile: "" },
      { row: 3, name: "", mobile: "9876500003" }, // kept, so the server reports the missing name
      { row: 4, name: 'Say "Hi", Co', mobile: "9876500004" },
    ]);
  });
});
