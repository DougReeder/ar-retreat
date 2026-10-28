// plane-process-system.ts — processes detected planes
// Copyright © 2026 Doug Reeder, under the GNU GPLv3 license

import {
    createSystem, Entity, eq, ge, Vector3, Box3,
    XRPlane, AssetManager, Quaternion,
} from '@iwsdk/core';
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
    private currentFloor: Entity | null = null;
    private birch1Entity: Entity | null = null;
    private tempVec = new Vector3();
    private tempQuat = new Quaternion();

    init() {
        this.queries.planes.subscribe('qualify', (entity) => {
            const plane: XRPlane = entity.getValue(XRPlane, '_plane') as XRPlane;
            const area = calculateArea(plane.polygon);
            entity.addComponent(PlaneClassification, {orientation: plane.orientation, area: area});
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
                this.destroyBirch1();
                for (const candidate of this.queries.floorCandidates.entities) {
                    this.checkFloorCandidate(candidate);
                }
            }
        });
    }

    private checkFloorCandidate(entity: Entity) {
        if (!entity.object3D || !this.camera) { return; }

        this.camera.getWorldPosition(this.tempVec);
        const targetY = this.tempVec.y - 1.6;

        const currentDist = this.currentFloor?.object3D ? Math.abs(this.currentFloor.object3D.getWorldPosition(new Vector3()).y - targetY) : Infinity;
        const candidateDist = Math.abs(entity.object3D.getWorldPosition(new Vector3()).y - targetY);

        if (!this.currentFloor || candidateDist < currentDist) {
            const area = entity.getValue(PlaneClassification, 'area');
            console.log(`setting new floor: area`, area, `y`, entity.object3D.position.y, `vertical dist. to target`, candidateDist);
            if (this.currentFloor?.object3D) {
                this.currentFloor.object3D.visible = false;
            }
            this.currentFloor = entity;
            entity.object3D.visible = true;

            this.updateBirch1ForFloor(entity);
        }
    }

    private updateBirch1ForFloor(floorEntity: Entity) {
        this.destroyBirch1();

        const plane: XRPlane = floorEntity.getValue(XRPlane, '_plane') as XRPlane;
        if (!plane || !plane.polygon || plane.polygon.length === 0) return;

        // Get camera position in local space of floorEntity.object3D.
        const localCameraPos = new Vector3();
        if (this.camera) {
            this.camera.getWorldPosition(localCameraPos);
            floorEntity.object3D!.worldToLocal(localCameraPos);
        } else {
            // Fallback to origin if camera is not available
            localCameraPos.set(0, 0, 0);
        }

        // Find the corner farthest from the camera.
        // plane.polygon is in local space of floorEntity.object3D.
        let farthestDistSq = -1;
        let farthestCornerLocal = plane.polygon[0];

        for (const point of plane.polygon) {
            this.tempVec.set(point.x, point.y, point.z);
            const distSq = this.tempVec.distanceToSquared(localCameraPos);
            if (distSq > farthestDistSq) {
                farthestDistSq = distSq;
                farthestCornerLocal = point;
            }
        }

        const asset = AssetManager.getGLTF('birch-1');
        console.log(`birch-1 asset`, asset);
        if (!asset) { return; }
        const birch1Object = asset.scene;

        this.birch1Entity = this.world.createTransformEntity(birch1Object);

        // Scale to 2 meters tall
        const box = new Box3().setFromObject(birch1Object);
        const size = new Vector3();
        box.getSize(size);
        if (size.y > 0) {
            const scale = 2.35 / size.y;
            birch1Object.scale.setScalar(scale);
        }

        // Calculate inward direction (towards floor center in local space)
        // plane.polygon center in local space
        const centerLocal = new Vector3(0, 0, 0);
        for (const point of plane.polygon) {
            centerLocal.x += point.x;
            centerLocal.z += point.z;
        }
        centerLocal.divideScalar(plane.polygon.length);

        const offset = new Vector3()
            .set(centerLocal.x - farthestCornerLocal.x, 0, centerLocal.z - farthestCornerLocal.z)
            .normalize()
            .multiplyScalar(3.0);

        const localPos = new Vector3(
            farthestCornerLocal.x + offset.x,
            farthestCornerLocal.y,
            farthestCornerLocal.z + offset.z
        );
        floorEntity.object3D!.localToWorld(localPos);
        this.birch1Entity.object3D!.position.copy(localPos);
    }

    private destroyBirch1() {
        if (this.birch1Entity) {
            this.birch1Entity.destroy();
            this.birch1Entity = null;
        }
    }

    update() {
    }
}
