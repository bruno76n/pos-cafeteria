const colores = ['bg-acero', 'bg-papel', 'bg-grafito', 'bg-grafito-suave', 'bg-linea', 'bg-cafeto', 'bg-faltante', 'bg-ambar'];

export function App() {
  return (
    <main className="p-4">
      <h1 className="text-pantalla font-bold">POS Cafetería</h1>
      <p className="text-grafito-suave">Atkinson Hyperlegible Next · $1,234.50</p>
      <div className="mt-4 flex gap-3">
        {colores.map((c) => (
          <div key={c} className={`${c} h-16 w-16 rounded-boton border border-linea`} title={c} />
        ))}
      </div>
    </main>
  );
}
