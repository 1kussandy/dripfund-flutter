import fs from 'fs';

async function runTest() {
  const url = 'http://localhost:3000';
  console.log('--- Starting Concurrency & High-Throughput Pre-Check URL:', url, '---');

  // Let's first ping the health of /api/system
  try {
    const res = await fetch(`${url}/api/system`);
    const data = await res.json();
    console.log('System health response:', data);
  } catch (err) {
    console.error('System health check failed. Is server running?', err.message);
    process.exit(1);
  }

  const managerCount = 30;
  const scanCount = 200;
  const scansPerSecond = 50;

  console.log(`\nSimulating concurrent actions:`);
  console.log(`- ${managerCount} Managers refreshing status`);
  console.log(`- ${scanCount} total AA scans at ${scansPerSecond} scans/sec`);

  // Define manager actions
  const fetchSystem = async (id) => {
    const start = Date.now();
    try {
      const res = await fetch(`${url}/api/system`);
      if (res.ok) {
        await res.json();
        return { success: true, latency: Date.now() - start };
      }
      return { success: false, error: `HTTP ${res.status}`, latency: Date.now() - start };
    } catch (err) {
      return { success: false, error: err.message, latency: Date.now() - start };
    }
  };

  const fetchPlacements = async (id) => {
    const start = Date.now();
    try {
      const res = await fetch(`${url}/api/placements`);
      if (res.ok) {
        await res.json();
        return { success: true, latency: Date.now() - start };
      }
      return { success: false, error: `HTTP ${res.status}`, latency: Date.now() - start };
    } catch (err) {
      return { success: false, error: err.message, latency: Date.now() - start };
    }
  };

  // Simulate scanning updates
  const postScan = async (badgeNum) => {
    const start = Date.now();
    try {
      // Simulate client-side update with savePlacementsRaw
      const res = await fetch(`${url}/api/placements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contextStations: { [`dummy-station-${badgeNum}`]: 'half1' },
          contextBadges: {},
          shiftAssignments: {}
        })
      });
      if (res.ok) {
        return { success: true, latency: Date.now() - start };
      }
      return { success: false, error: `HTTP ${res.status}`, latency: Date.now() - start };
    } catch (err) {
      return { success: false, error: err.message, latency: Date.now() - start };
    }
  };

  // Run managers concurrently
  console.log('\nStep 1: Simulating 30 concurrent manager actions...');
  const managerPromises = [];
  for (let i = 0; i < managerCount; i++) {
    managerPromises.push(fetchSystem(i));
    managerPromises.push(fetchPlacements(i));
  }
  const managerResults = await Promise.all(managerPromises);
  const managerLatencies = managerResults.map(r => r.latency);
  const avgManagerLatency = managerLatencies.reduce((a, b) => a + b, 0) / managerLatencies.length;
  const managerFailures = managerResults.filter(r => !r.success);
  console.log(`Manager simulation: Avg latency: ${avgManagerLatency.toFixed(2)}ms, Failures: ${managerFailures.length}`);

  // Run high-throughput scanning
  console.log('\nStep 2: Simulating high throughput (200 scans total, 50 scans/second)...');
  const scanPromises = [];
  const startScanTime = Date.now();
  
  for (let i = 0; i < scanCount; i++) {
    const delay = (i / scansPerSecond) * 1000;
    const promise = new Promise((resolve) => {
      setTimeout(async () => {
        const res = await postScan(100000 + i);
        resolve(res);
      }, delay);
    });
    scanPromises.push(promise);
  }

  // Also have managers hit the system concurrently DURING scanning
  const backgroundManagerActivity = setInterval(async () => {
    const res = await fetchSystem(999);
    if (!res.success) {
      console.log('Manager background fetch failed during scan load:', res.error);
    }
  }, 100);

  const scanResults = await Promise.all(scanPromises);
  clearInterval(backgroundManagerActivity);

  const scanLatencies = scanResults.map(r => r.latency);
  const avgScanLatency = scanLatencies.reduce((a, b) => a + b, 0) / scanLatencies.length;
  const maxScanLatency = Math.max(...scanLatencies);
  const scanFailures = scanResults.filter(r => !r.success);

  console.log(`Scan simulation completed:`);
  console.log(`- Avg latency: ${avgScanLatency.toFixed(2)}ms`);
  console.log(`- Max latency: ${maxScanLatency}ms`);
  console.log(`- Total failures: ${scanFailures.length}`);

  if (scanFailures.length > 0 || avgScanLatency > 150) {
    console.log('\n❌ PERFORMANCE CHECK FAILED! High latency or write failures occurred.');
  } else {
    console.log('\n✅ PERFORMANCE CHECK PASSED!');
  }
}

runTest();
