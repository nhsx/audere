// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an MIT-style license that
// can be found in the LICENSE file distributed with this file

import React, { useState } from "react";
import {
  EncounterDocument,
  EncounterInfo,
  EncounterTriageDocument,
} from "audere-lib/dist/ebPhotoStoreProtocol";
import {
  GoogleMap,
  Marker,
  InfoWindow,
  withGoogleMap,
  withScriptjs,
} from "react-google-maps";
import { getApi } from "./api";

const EVD_POS = 1;
const EVD_NEG = 2;
const EVD_UNTRIAGED = 3;

interface Props {
  encounters: EncounterDocument[];
  tDocs: EncounterTriageDocument[];
  style: React.CSSProperties;
  zoom: number;
}

interface Location {
  name: string;
  date: string;
  latitude: number;
  longitude: number;
  docId: string;
  diagnosis: number;
}

interface LatLng {
  lat: number;
  lng: number;
}

interface State {
  apiKey?: string;
}

export class SimpleMap extends React.Component<Props, State> {
  state: State = {};
  componentWillMount() {
    this.loadApiKey();
  }
  private async loadApiKey() {
    const apiKey = await getApi().getGoogleCloudApiKey();
    console.log(apiKey);
    this.setState({ apiKey });
  }
  private rad2degr(rad: number) {
    return (rad * 180) / Math.PI;
  }
  private degr2rad(degr: number) {
    return (degr * Math.PI) / 180;
  }
  //https://stackoverflow.com/questions/6671183/calculate-the-center-point-of-multiple-latitude-longitude-coordinate-pairs/14231286
  private computeCenter(locations: Location[]): LatLng {
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;

    for (let loc of locations) {
      let lat = this.degr2rad(loc.latitude);
      let lng = this.degr2rad(loc.longitude);
      sumX += Math.cos(lat) * Math.cos(lng);
      sumY += Math.cos(lat) * Math.sin(lng);
      sumZ += Math.sin(lat);
    }
    const avgX = sumX / locations.length;
    const avgY = sumY / locations.length;
    const avgZ = sumZ / locations.length;
    const lng = Math.atan2(avgY, avgX);
    const hyp = Math.sqrt(avgX * avgX + avgY * avgY);
    const lat = Math.atan2(avgZ, hyp);

    const center = { lat: this.rad2degr(lat), lng: this.rad2degr(lng) };
    return center;
  }

  private getMapCenter(locations: Location[]): LatLng {
    if (locations.length === 1) {
      return {
        lat: locations[0].latitude,
        lng: locations[0].longitude,
      };
    } else {
      return {
        lat: -3.4,
        lng: 22.7,
      };
    }
  }

  private static getDiagnosis(
    eDoc: EncounterDocument,
    tDocs: EncounterTriageDocument[]
  ) {
    const tDoc = tDocs.find(t => t.docId === eDoc.docId);

    if (tDoc === undefined || !tDoc.triage.diagnoses) {
      return EVD_UNTRIAGED;
    }
    const { diagnoses } = tDoc.triage;
    if (diagnoses.length > 0 && diagnoses[diagnoses.length - 1].value) {
      return EVD_POS;
    }
    return EVD_NEG;
  }

  private static getLocations(
    encounters: EncounterDocument[],
    tDocs: EncounterTriageDocument[]
  ) {
    return encounters
      .filter(
        (eDoc: EncounterDocument) =>
          !!eDoc.encounter.rdtPhotos && eDoc.encounter.rdtPhotos.length > 0
      )
      .map((eDoc: EncounterDocument) => {
        const enc: EncounterInfo = eDoc.encounter;
        const diagnosis = SimpleMap.getDiagnosis(eDoc, tDocs);
        //const triage = await getApi().loadTriage(eDoc.docId);
        return {
          name: enc.patient.lastName + ", " + enc.patient.firstName,
          date: enc.rdtPhotos[0].timestamp.substring(0, 10),
          latitude: +enc.rdtPhotos[0].gps.latitude,
          longitude: +enc.rdtPhotos[0].gps.longitude,
          diagnosis,
          docId: eDoc.docId,
        };
      });
  }

  MyGoogleMap = withScriptjs(
    withGoogleMap((props: { locations: Location[] }) => (
      <GoogleMap
        defaultCenter={this.getMapCenter(props.locations!)}
        defaultZoom={this.props.zoom}
      >
        {props.locations.map((location: Location) => (
          <SimpleMarker location={location} />
        ))}
      </GoogleMap>
    ))
  );
  loadingElement = <div />;
  containerElement = <div style={this.props.style} />;
  mapElement = <div style={this.props.style} />;

  public render(): React.ReactNode {
    const locations = SimpleMap.getLocations(
      this.props.encounters,
      this.props.tDocs
    );
    const googleMapURL = `https://maps.googleapis.com/maps/api/js?v=3.exp&key=${this.state.apiKey}`;
    return (
      <div>
        {this.state.apiKey == null || locations == null ? (
          "Loading..."
        ) : (
          <div style={this.props.style}>
            <this.MyGoogleMap
              loadingElement={this.loadingElement}
              containerElement={this.containerElement}
              googleMapURL={googleMapURL}
              mapElement={this.mapElement}
              locations={locations}
            />
          </div>
        )}
      </div>
    );
  }
}

interface SimpleMarkerProps {
  location: Location;
}

const SimpleMarker: React.FC<SimpleMarkerProps> = props => {
  const { location } = props;
  const [open, setOpen] = useState(false);

  return (
    <Marker
      position={{ lat: location.latitude, lng: location.longitude }}
      icon={{ url: getIconUrl(location.diagnosis) }}
      key={location.docId}
      onClick={() => setOpen(!open)}
    >
      {open && (
        <InfoWindow>
          <span>
            {location.name} <br />
            {location.date} <br />
            <a href={`/patient-detail/${location.docId}`}>Details</a>
          </span>
        </InfoWindow>
      )}
    </Marker>
  );
};

function getIconUrl(diagnosis: number): string {
  switch (diagnosis) {
    case EVD_POS:
      return "http://maps.google.com/mapfiles/ms/icons/red-dot.png";
    case EVD_NEG:
      // Would prefer gray but Google doesn't offer a gray dot
      return "http://maps.google.com/mapfiles/ms/icons/green-dot.png";
    case EVD_UNTRIAGED:
    default:
      return "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png";
  }
}
