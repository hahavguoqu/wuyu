export const QUARTER_TURN=Math.PI/2;
export function rotationDetent(angle){
  const turn=Math.round(angle/QUARTER_TURN);
  return {angle:turn*QUARTER_TURN,orientation:((turn%4)+4)%4};
}
// Project movement onto the screen-space rail, independent of screen size.
export function travelFromDrag(initial,delta,rail){
  const length=rail.x*rail.x+rail.y*rail.y;
  if(length<1)return initial;
  return Math.max(0,Math.min(1,initial+(delta.x*rail.x+delta.y*rail.y)/length));
}
export function angularDelta(from,to){return Math.atan2(Math.sin(to-from),Math.cos(to-from));}
// Screen angles increase clockwise. Account for the mechanism's axis sign so
// the handle follows the same direction as the pointer on every chapter.
export function rotationFromCircularDrag(initial,delta,sign=1){return initial-delta*sign;}
