export class RoomChangedEvent {
  constructor(
    readonly stayId: number,
    readonly oldRoomId: number,
    readonly newRoomId: number,
    readonly userId?: number,
  ) {}
}
