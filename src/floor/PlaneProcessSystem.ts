// plane-process-system.ts — processes detected planes
// Copyright © 2026 Doug Reeder, under the GNU GPLv3 license

import {
    createSystem, Entity, eq, ExtrudeGeometry, ge, gt, Mesh, RayInteractable,
    Shape,
    XRPlane,
} from '@iwsdk/core';
import {graphiteMaterial} from "../scene-assets/studio.scene-asset";
import {Orientation, PlaneClassification} from "./PlaneClassification";

function calculateArea(polygon: DOMPointReadOnly[]): number {
    let area = 0;
    for (let i = 0; i < polygon.length; i++) {
        const j = (i + 1) % polygon.length;
        area += polygon[i].x * polygon[j].z;
        area -= polygon[j].x * polygon[i].z;
    }
    return Math.abs(area) / 2;
}

export class PlaneProcessSystem extends createSystem({
    planes: { required: [XRPlane] },
    floorCandidates: { required: [XRPlane, PlaneClassification], where: [eq(PlaneClassification, 'orientation', Orientation.Horizontal), ge(PlaneClassification, 'area', 3)]},
}) {
    // private qualifyingEntities = new Set<Entity>();
    private currentFloor: Entity | null = null;

    init() {
        this.queries.planes.subscribe('qualify', (entity) => {
            const plane: XRPlane = entity.getValue(XRPlane, '_plane') as XRPlane;
            const area = calculateArea(plane.polygon);
            entity.addComponent(PlaneClassification, {orientation: plane.orientation, area: area});
            // if (plane.orientation === 'horizontal') {
            //     console.log(`plane orientation`, plane.orientation, `area`, area, `y`, entity.object3D?.position.y, `plane object`, entity.object3D,);
            // }
        });

        this.queries.floorCandidates.subscribe('qualify', entity => {
            // const orientation = entity.getValue(PlaneClassification, 'orientation');
            // const area = entity.getValue(PlaneClassification, 'area');
            // console.log(`floor candidate: orientation`, orientation, `area`, area, `y`, entity.object3D?.position.y, `plane object`, entity.object3D,);
            this.checkFloorCandidate(entity);
        });

        this.queries.floorCandidates.subscribe('disqualify', entity => {
            if (this.currentFloor === entity) {
                console.info(`lost floor`, entity);
                this.currentFloor = null;
                for (const entity of this.queries.floorCandidates.entities) {
                    this.checkFloorCandidate(entity);
                }
            }
        });
    }

    private checkFloorCandidate(entity: Entity) {
        if (!entity.object3D) { return; }
        // @ts-ignore
        if (!this.currentFloor || entity.object3D?.position.y < this.currentFloor.object3D?.position.y) {
            const area = entity.getValue(PlaneClassification, 'area');
            console.log(`setting new floor: area`, area, `y`, entity.object3D?.position.y, `plane object`, entity.object3D,);
            if (this.currentFloor?.object3D) {
                this.currentFloor.object3D.visible = false;
            }
            this.currentFloor = entity;
            entity.object3D.visible = true;
        }
    }

    update() {
    }
}
