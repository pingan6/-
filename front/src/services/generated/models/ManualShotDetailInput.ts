/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CameraAngle } from './CameraAngle';
import type { CameraMovement } from './CameraMovement';
import type { CameraShotType } from './CameraShotType';
/**
 * Explicit director choices used for atomic manual shot creation; no inferred facts.
 */
export type ManualShotDetailInput = {
    camera_shot: CameraShotType;
    angle: CameraAngle;
    movement: CameraMovement;
    duration?: number;
};
