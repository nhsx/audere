// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an MIT-style license that
// can be found in the LICENSE file distributed with this file.

import React, { MouseEvent } from 'react';
import { Redirect, RouteComponentProps, withRouter } from "react-router-dom";
import ReactTable, { Column } from 'react-table';
import "react-table/react-table.css";

import { EncounterDocument, EncounterTriageDocument } from "audere-lib/dist/ebPhotoStoreProtocol";
import { getApi } from "./api";
import { LoggedInAs } from "./LoggedInAs";

export interface PatientsListPageProps extends RouteComponentProps<{}> {
}

export interface PatientsListPageState {
  eDocs: EncounterDocument[] | null;
}

class PatientListPageAssumeRouter extends React.Component<PatientsListPageProps, PatientsListPageState> {
  constructor(props: PatientsListPageProps) {
    super(props);
    this.state = { eDocs: null };
  }

  componentDidMount() {
    this.load();
  }

  private async load(): Promise<void> {
    const encounters = await getApi().loadEncounters();
    this.setState({
      eDocs: encounters.docs.map((x: any) => x.data() as EncounterDocument)
    });
  }

  private select = (e: MouseEvent, eDoc: EncounterDocument) => {
    e.preventDefault();
    // TODO: guard against injection via docId here.
    this.props.history.push(`/patient-detail/${eDoc.docId}`);
  }

  public render(): React.ReactNode {
    const { eDocs: records } = this.state;
    return (
      <div>
        <LoggedInAs />
        {records == null ? (
          "Loading..."
        ) : (
          <PatientTable eDocs={records} onSelect={this.select} />
        )}
      </div>
    );
  }
}

export const PatientListPage = withRouter(PatientListPageAssumeRouter);

interface PatientTableRow {
  eDoc: EncounterDocument;
  tDoc: EncounterTriageDocument | null;
}

interface PatientTableProps {
  eDocs: EncounterDocument[];
  onSelect: (e: MouseEvent, record: EncounterDocument) => void
}

interface PatientTableState {
  rows: PatientTableRow[];
  selected: EncounterDocument | null;
}

class PatientTable extends React.Component<PatientTableProps, PatientTableState> {
  constructor(props: PatientTableProps) {
    super(props);
    this.state = {
      selected: null,
      rows: this.props.eDocs.map(eDoc => ({ eDoc, tDoc: null })),
    };
  }

  componentDidMount() {
    this.load();
  }

  private async load(): Promise<void> {
    const api = getApi();
    // TODO: only visible

    const rows = await Promise.all(
      this.props.eDocs.map(async eDoc => {
        try {
          const triage = await api.loadTriage(eDoc.docId);
          return {
            eDoc,
            tDoc: triage.data() as EncounterTriageDocument || {
              triage: {
                notes: "",
                testIndicatesEVD: false,
              }
            },
          };
        } catch (err) {
          console.log(`PatientListPage error loading triage '${eDoc.docId}'`);
          return { eDoc, tDoc: null };
        }
      })
    );
    this.setState({ rows });
  }

  private getTrProps = (state: any, row: any, column: any, instance: any) => {
    return {
      onClick: (e: MouseEvent, handleOriginal: () => void) => {
        this.props.onSelect(e, row.original.eDoc);
      }
    };
  }

  columns(): Column<PatientTableRow>[] {
    return [
      {
        Header: "Timestamp",
        accessor: "eDoc.encounter.rdtPhotos[0].timestamp",
        minWidth: 150,
      },
      {
        Header: "Worker Name",
        accessor: row => {
          const w = row.eDoc.encounter.healthWorker;
          return `${w.firstName} ${w.lastName}`;
        },
        id: "healthWorker.name",
        minWidth: 120,
      },
      {
        Header: "Worker Phone",
        accessor: "eDoc.encounter.healthWorker.phone",
        minWidth: 80,
      },
      {
        Header: "ID",
        accessor: "eDoc.encounter.localIndex",
        minWidth: 40,
      },
      {
        Header: "Patient",
        accessor: row => {
          const p = row.eDoc.encounter.patient;
          return `${p.firstName} ${p.lastName}`;
        },
        id: "patient.name",
        minWidth: 120,
      },
      {
        Header: "Triage",
        accessor: row => row.tDoc == null ? "Loading.." : firstLine(row.tDoc.triage.notes),
        id: "triage",
        minWidth: 200,
      },
      {
        Header: "EVD",
        accessor: r => r.tDoc == null ? ".." : (r.tDoc.triage.testIndicatesEVD ? "yes" : "no"),
        id: "evd",
        minWidth: 40,
      },
    ];
  }

  public render(): React.ReactNode {
    const { selected } = this.state;
    return selected != null ? (
      <Redirect to={`/patient-detail/${selected.docId}`}/>
    ) : (
      <ReactTable
        data={this.state.rows}
        columns={this.columns()}
        show-pagination={false}
        default-page-size={100}
        getTrProps={this.getTrProps}
      />
    );
  }
}

function firstLine(s: string | null): string {
  if (s == null || typeof s !== "string") {
    return "";
  }
  const index = s.indexOf("\n");
  return index < 0 ? s : s.substring(0, index);
}