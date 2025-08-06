document.addEventListener('DOMContentLoaded', () => {
    // Referencias a los elementos del DOM
    const fechaInput = document.getElementById('fecha');
    const nombreClienteInput = document.getElementById('nombre-cliente');
    const numeroInput = document.getElementById('numero');
    const cantidadInput = document.getElementById('cantidad');
    const agregarBilleteBtn = document.getElementById('agregar-billete');
    const listaBilletesTbody = document.getElementById('lista-billetes');
    const totalBilletesSpan = document.getElementById('total-billetes');
    const totalPagarSpan = document.getElementById('total-pagar');
    const finalizarVentaBtn = document.getElementById('finalizar-venta');
    const cerrarDiaBtn = document.getElementById('cerrar-dia');
    const verHistorialBtn = document.getElementById('ver-historial');
    const borrarHistorialBtn = document.getElementById('borrar-historial-btn');
    const agregarVentaPruebaBtn = document.getElementById('agregar-venta-prueba-btn');

    let billetesVendidos = [];
    const costoBillete = 0.25;

    let ventasDelDia = JSON.parse(localStorage.getItem('ventasDelDia')) || [];

    const hoy = new Date();
    fechaInput.value = hoy.toLocaleDateString();

    function actualizarResumen() {
        let totalBilletes = 0;
        let totalPagar = 0;

        billetesVendidos.forEach(billete => {
            totalBilletes += billete.cantidad;
            totalPagar += billete.cantidad * costoBillete;
        });

        totalBilletesSpan.textContent = totalBilletes;
        totalPagarSpan.textContent = totalPagar.toFixed(2);
    }

    function renderizarListaBilletes() {
        listaBilletesTbody.innerHTML = '';
        billetesVendidos.forEach((billete, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${String(billete.numero).padStart(2, '0')}</td>
                <td>${billete.cantidad}</td>
                <td>$${(billete.cantidad * costoBillete).toFixed(2)}</td>
                <td><button class="eliminar-billete" data-index="${index}">Eliminar</button></td>
            `;
            listaBilletesTbody.appendChild(row);
        });

        actualizarResumen();
    }

    agregarBilleteBtn.addEventListener('click', agregarBillete);

    numeroInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            agregarBillete();
        }
    });

    cantidadInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            agregarBillete();
        }
    });
    
    function agregarBillete() {
        const numero = parseInt(numeroInput.value);
        const cantidad = parseInt(cantidadInput.value);

        if (isNaN(numero) || isNaN(cantidad) || numero < 0 || numero > 99 || cantidad < 1 || cantidad > 100) {
            alert('Por favor, ingresa un número y una cantidad válidos.');
            if (isNaN(numero) || numero < 0 || numero > 99) {
                numeroInput.focus();
            } else {
                cantidadInput.focus();
            }
            return;
        }
        
        const billeteExistente = billetesVendidos.find(b => b.numero === numero);
        if (billeteExistente) {
            if (billeteExistente.cantidad + cantidad > 100) {
                alert(`No puedes comprar más de 100 del número ${String(numero).padStart(2, '0')}. Cantidad actual: ${billeteExistente.cantidad}`);
                cantidadInput.focus();
                return;
            }
            billeteExistente.cantidad += cantidad;
        } else {
            billetesVendidos.push({ numero, cantidad });
        }

        renderizarListaBilletes();

        numeroInput.value = '';
        cantidadInput.value = '';
        numeroInput.focus();
    }
    
    listaBilletesTbody.addEventListener('click', (e) => {
        if (e.target.classList.contains('eliminar-billete')) {
            const index = e.target.dataset.index;
            billetesVendidos.splice(index, 1);
            renderizarListaBilletes();
        }
    });

    finalizarVentaBtn.addEventListener('click', () => {
        const nombreCliente = nombreClienteInput.value.trim();
        if (nombreCliente === '' || billetesVendidos.length === 0) {
            alert('Por favor, ingresa el nombre del cliente y al menos un billete.');
            nombreClienteInput.focus();
            return;
        }

        const ventaFinal = {
            fecha: fechaInput.value,
            cliente: nombreCliente,
            billetes: [...billetesVendidos],
            totalBilletes: parseInt(totalBilletesSpan.textContent),
            totalPagar: parseFloat(totalPagarSpan.textContent),
        };

        ventasDelDia.push(ventaFinal);
        localStorage.setItem('ventasDelDia', JSON.stringify(ventasDelDia));

        if (confirm('Venta finalizada exitosamente. ¿Desea imprimir el documento PDF?')) {
            generarPDF(ventaFinal, '/generar-factura-pdf');
        }

        billetesVendidos = [];
        nombreClienteInput.value = '';
        renderizarListaBilletes();
    });
    
    async function generarPDF(ventaData, endpoint) {
        try {
            const response = await fetch(`https://loteria-backend-qwmq.onrender.com${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ventaData)
            });

            if (!response.ok) {
                throw new Error(`Error en el servidor: ${response.statusText}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `documento_${ventaData.cliente || 'cierre'}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error al generar el PDF:', error);
            alert('Ocurrió un error al generar el PDF. Por favor, revisa la consola para más detalles.');
        }
    }

    cerrarDiaBtn.addEventListener('click', () => {
        if (ventasDelDia.length === 0) {
            alert('No hay ventas registradas para el día.');
            return;
        }
        
        generarPDF(ventasDelDia, '/generar-reporte-cierre');
    });
    
    verHistorialBtn.addEventListener('click', () => {
        window.open('historial.html', '_blank');
    });

    if (borrarHistorialBtn) {
        borrarHistorialBtn.addEventListener('click', () => {
            if (confirm('¿Está seguro de que desea borrar todo el historial de ventas? Esta acción es irreversible.')) {
                localStorage.removeItem('ventasDelDia');
                ventasDelDia = [];
                alert('El historial de ventas ha sido borrado exitosamente.');
                location.reload();
            }
        });
    }

    if (agregarVentaPruebaBtn) {
        agregarVentaPruebaBtn.addEventListener('click', () => {
            const numVentas = parseInt(prompt('¿Cuántas ventas de prueba quieres agregar?'));

            if (isNaN(numVentas) || numVentas <= 0) {
                alert('Por favor, ingresa un número válido mayor a cero.');
                return;
            }

            let historialActual = JSON.parse(localStorage.getItem('ventasDelDia')) || [];
            
            for (let i = 0; i < numVentas; i++) {
                const billetesDePrueba = [];
                let totalBilletes = 0;
                let totalPagar = 0;

                for (let j = 0; j <= 99; j++) {
                    const cantidadAleatoria = Math.floor(Math.random() * 11);
                    if (cantidadAleatoria > 0) {
                        billetesDePrueba.push({
                            numero: j,
                            cantidad: cantidadAleatoria
                        });
                        totalBilletes += cantidadAleatoria;
                        totalPagar += cantidadAleatoria * 0.25;
                    }
                }

                const ventaPrueba = {
                    fecha: new Date().toLocaleDateString(),
                    cliente: `Cliente de Prueba ${historialActual.length + 1 + i}`,
                    billetes: billetesDePrueba,
                    totalBilletes: totalBilletes,
                    totalPagar: totalPagar,
                };

                historialActual.push(ventaPrueba);
            }
            
            localStorage.setItem('ventasDelDia', JSON.stringify(historialActual));
            
            alert(`${numVentas} ventas de prueba agregadas exitosamente.`);
            location.reload();
        });
    }
});