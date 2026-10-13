// Run with npm run benchmark:sandbox. Timings exclude world construction.
import { performance } from 'node:perf_hooks'
import { SandboxCellSystem, updatePowerStateFromNeighbors } from '../src/features/sandbox/cellSystem.ts'

function benchmark(name, setup, run) {
  const samples = []
  let result
  for (let iteration = 0; iteration < 10; iteration += 1) {
    const system = setup()
    const start = performance.now()
    result = run(system)
    const duration = performance.now() - start
    if (iteration >= 3) samples.push(duration)
  }
  samples.sort((first, second) => first - second)
  console.log(`${name}: ${samples[Math.floor(samples.length / 2)].toFixed(2)} ms median; ${result}`)
}

const side = 48
const markers = Array.from({ length: side * side }, (_, index) => ({
  cellKey: `${index % side},${Math.floor(index / side)}`,
  corner: index % 4,
}))

benchmark('200,000 readonly state reads', () => new SandboxCellSystem(markers), (system) => {
  let checksum = 0
  for (let index = 0; index < 200_000; index += 1) {
    checksum += system.getState(markers[index % markers.length].cellKey).corner
  }
  return `checksum=${checksum}`
})

benchmark('Power propagation through 4,096 cells', () => new SandboxCellSystem([
  { cellKey: '-1,0', corner: 2 },
  ...Array.from({ length: 4096 }, (_, x) => ({ cellKey: `${x},0`, corner: x === 0 ? 0 : 1 })),
], [updatePowerStateFromNeighbors]), (system) => {
  system.rotateCornerFromUser('0,0')
  let processed = 0
  while (system.hasPendingUpdates() && processed < 100_000) processed += system.processUpdates(1024)
  return `updates=${processed}, powered=${system.getMarkers().filter((marker) => marker.isOn).length}`
})

benchmark('100,000 dense broadcasts (including repeats)', () => new SandboxCellSystem(markers, [() => true]), (system) => {
  system.rotateCornerFromUser('24,24')
  return `updates=${system.processUpdates(100_000)}`
})
