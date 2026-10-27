/** A delayed cloud read must never replace a newer on-screen save. */
export function createTrainingSyncGate() {
  let generation = 0;
  let writing = false;
  let reading = false;
  return {
    beginRead() {
      if (writing || reading) return null;
      reading = true;
      return generation;
    },
    acceptsRead(ticket: number) { return !writing && ticket === generation; },
    invalidateRead() { generation += 1; },
    endRead() { reading = false; },
    beginWrite() {
      if (writing) return false;
      writing = true;
      generation += 1;
      return true;
    },
    endWrite() { writing = false; },
  };
}
