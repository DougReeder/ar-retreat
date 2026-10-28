import {createComponent, Types} from '@iwsdk/core';

export const Orientation = { Horizontal: 'horizontal', Vertical: 'vertical', Slantwise: 'slantwise' };
export const PlaneKind = { Obstacle: 'obstacle', Floor: 'floor' };

export const PlaneClassification = createComponent('PlaneClassification', {
    orientation: { type: Types.Enum, enum: Orientation, default: Orientation.Slantwise },
    area: { type: Types.Float32, default: 0.1 },
    kind: { type: Types.Enum, enum: PlaneKind, default: PlaneKind.Obstacle },
}, "contains semantic info on detected XRPlanes");
