document.addEventListener('DOMContentLoaded', () => {
    const historialVentasDiv = document.getElementById('historial-ventas');
    const ventasDelDia = JSON.parse(localStorage.getItem('ventasDelDia')) || [];
    
    async function generarPDF(ventaData) {
        try {
            const response = await fetch('http://localhost:3000/generar-factura-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(ventaData)
            });

            if (!response.ok) {
                throw new Error(`Error en el servidor: ${response.statusText}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `factura_${ventaData.cliente}_reimpresion.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error al generar el PDF:', error);
            alert('Ocurrió un error al generar el PDF. Por favor, revisa la consola para más detalles.');
        }
    }

    if (ventasDelDia.length === 0) {
        historialVentasDiv.innerHTML = '<p>No hay ventas registradas en el historial.</p>';
    } else {
        ventasDelDia.forEach((venta, index) => {
            const ventaClienteDiv = document.createElement('div');
            ventaClienteDiv.classList.add('venta-cliente');
            
            let billetesHtml = '';
            venta.billetes.forEach(billete => {
                billetesHtml += `
                    <tr>
                        <td>${String(billete.numero).padStart(2, '0')}</td>
                        <td>${billete.cantidad}</td>
                        <td>$${(billete.cantidad * 0.25).toFixed(2)}</td>
                    </tr>
                `;
            });
    
            ventaClienteDiv.innerHTML = `
                <h3>Venta a: ${venta.cliente}</h3>
                <p>Fecha: ${venta.fecha}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Número</th>
                            <th>Cantidad</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${billetesHtml}
                    </tbody>
                </table>
                <p><strong>Total de Billetes:</strong> ${venta.totalBilletes}</p>
                <p><strong>Total a Pagar:</strong> $${venta.totalPagar.toFixed(2)}</p>
                <button class="reimprimir-btn" data-index="${index}">Reimprimir</button>
            `;
            historialVentasDiv.appendChild(ventaClienteDiv);
        });
    }

    // Evento para el botón de reimprimir
    historialVentasDiv.addEventListener('click', (e) => {
        if (e.target.classList.contains('reimprimir-btn')) {
            const index = e.target.dataset.index;
            const ventaAImprimir = ventasDelDia[index];
            generarPDF(ventaAImprimir);
        }
    });
});