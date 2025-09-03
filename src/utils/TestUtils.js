// Simple test tank visualization
export function createTestTank(scene, x, y, color, name) {
  // Create tank visual
  const tank = scene.add.container(x, y);
  
  // Tank body
  const body = scene.add.rectangle(0, 0, 16, 16, color);
  tank.add(body);
  
  // Tank turret
  const turret = scene.add.rectangle(0, -8, 4, 12, color);
  tank.add(turret);
  
  // Tank name
  const nameText = scene.add.text(0, -20, name, {
    fontSize: '10px',
    fill: '#ffffff'
  });
  nameText.setOrigin(0.5);
  tank.add(nameText);
  
  return tank;
}