const express = require('express');
const PDFDocument = require('pdfkit');
const cors = require('cors');
const fs = require('fs');

const app = express();
const port = 3000;

const corsOptions = {
    origin: 'http://127.0.0.1:8080',
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

// Función para dibujar una línea
function drawLine(doc, y) {
    doc.moveTo(10, y)
       .lineTo(216.77, y)
       .stroke();
}

// --- RUTA 1: Generar la factura de venta y reimpresión ---
app.post('/generar-factura-pdf', (req, res) => {
    const ventaData = req.body;
    
    // Configuración con márgenes y tamaño de recibo
    const doc = new PDFDocument({ 
        size: [226.77, 'letter'], // Se utiliza tamaño letter para manejar paginación
        margins: 15,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=factura_${ventaData.cliente}.pdf`);
    doc.pipe(res);

    let yPos = doc.y;

    doc.font('Helvetica-Bold').fontSize(10).text('COMPROBANTE DE VENTA', { align: 'center' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(8).text(`Fecha: ${ventaData.fecha}`, { align: 'center' });
    doc.moveDown(0.2);
    doc.text(`Cliente: ${ventaData.cliente}`, { align: 'center' });
    doc.moveDown(1);

    doc.font('Helvetica-Bold').fontSize(8).text('Detalle de la Compra');
    doc.moveDown(0.5);

    const headerY = doc.y;
    doc.font('Helvetica-Bold')
       .text('Número', doc.x, headerY, { width: 50 })
       .text('Cantidad', doc.x + 75, headerY, { width: 50 })
       .text('Subtotal', doc.x + 130, headerY, { align: 'right', width: 60 });
    doc.moveDown(0.2);
    drawLine(doc, doc.y);
    doc.moveDown(0.2);

    doc.font('Helvetica');
    ventaData.billetes.forEach(billete => {
        // Lógica de paginación mejorada
        if (doc.y + 20 > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
            doc.moveDown(0.5);
        }
        
        doc.text(String(billete.numero).padStart(2, '0'), doc.x, doc.y, { continued: true, width: 50 });
        doc.text(billete.cantidad.toString(), doc.x + 75, doc.y, { continued: true, width: 50 });
        doc.text(`$${(billete.cantidad * 0.25).toFixed(2)}`, doc.x + 130, doc.y, { align: 'right', width: 60 });
        doc.moveDown(0.2);
    });

    doc.moveDown(1);
    
    doc.font('Helvetica-Bold').fontSize(8)
       .text(`Total de Billetes: ${ventaData.totalBilletes}`, doc.x, doc.y)
       .text(`Total a Pagar: $${ventaData.totalPagar.toFixed(2)}`, doc.x, doc.y + 12);
    doc.moveDown(2);

    doc.end();
});

// --- RUTA 2: Generar el reporte de cierre del día ---
app.post('/generar-reporte-cierre', (req, res) => {
    const ventasDelDia = req.body;
    
    if (!ventasDelDia || ventasDelDia.length === 0) {
        res.status(400).send('No hay ventas para generar un reporte.');
        return;
    }
    
    const fecha = ventasDelDia[0].fecha.replace(/\//g, '-');
    const hora = new Date().toLocaleTimeString().replace(/:/g, '-').replace(/\s/g, '');
    const filename = `historial_${fecha}_${hora}.json`;
    const folder = 'respaldos';

    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
    }
    
    fs.writeFile(`${folder}/${filename}`, JSON.stringify(ventasDelDia, null, 2), err => {
        if (err) {
            console.error('Error al guardar el archivo de respaldo:', err);
        } else {
            console.log(`Historial guardado en ${folder}/${filename}`);
        }
    });

    const conteoNumeros = {};
    for (let i = 0; i <= 99; i++) {
        conteoNumeros[i] = 0;
    }

    ventasDelDia.forEach(venta => {
        venta.billetes.forEach(billete => {
            if (conteoNumeros.hasOwnProperty(billete.numero)) {
                conteoNumeros[billete.numero] += billete.cantidad;
            }
        });
    });

    const doc = new PDFDocument({ 
        size: 'letter', 
        margins: { top: 30, bottom: 30, left: 30, right: 30 } 
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_cierre_${fecha}.pdf`);
    doc.pipe(res);

    let yPos = 30;
    const pageMargin = 30;
    const contentWidth = doc.page.width - 2 * pageMargin;
    const tableYStart = 90;
    const rowHeight = 18;
    const cellWidth = 50;
    const totalCols = 4;
    const padding = 5;
    const lightGray = '#f0f0f0';
    const white = '#ffffff';

    doc.font('Helvetica-Bold').fontSize(14).text('REPORTE DE CIERRE DEL DÍA', pageMargin, yPos, { align: 'center', width: contentWidth });
    yPos += 20;
    doc.font('Helvetica').fontSize(10).text(`Fecha: ${ventasDelDia[0].fecha}`, pageMargin, yPos, { align: 'center', width: contentWidth });
    yPos += 30;

    const columnTotals = [0, 0, 0, 0];
    let grandTotal = 0;
    const tableXStart = (doc.page.width - (totalCols * cellWidth * 2)) / 2;

    for (let i = 0; i < 25; i++) {
        const rowY = tableYStart + (i * rowHeight);
        const fillColor = i % 2 === 0 ? lightGray : white;
        
        for (let j = 0; j < totalCols; j++) {
            const numero = i + j * 25;
            if (numero <= 99) {
                const count = conteoNumeros[numero];
                columnTotals[j] += count;
                grandTotal += count;
                const xPosNum = tableXStart + (j * (cellWidth * 2));
                const xPosCount = xPosNum + cellWidth;
                
                doc.fillColor(fillColor).rect(xPosNum, rowY, cellWidth, rowHeight).fill().stroke();
                doc.fillColor(fillColor).rect(xPosCount, rowY, cellWidth, rowHeight).fill().stroke();
                
                doc.fillColor('black').font('Helvetica').fontSize(10).text(String(numero).padStart(2, '0'), xPosNum + padding, rowY + padding);
                doc.text(count, xPosCount + padding, rowY + padding);
            }
        }
    }
    
    yPos = tableYStart + (25 * rowHeight);
    let totalsTextX = tableXStart;
    doc.fillColor(lightGray).rect(totalsTextX, yPos, cellWidth, rowHeight).fill().stroke();
    doc.font('Helvetica-Bold').fontSize(10).text('Total', totalsTextX + padding, yPos + padding);
    
    for (let j = 0; j < totalCols; j++) {
        const xPosNum = tableXStart + (j * (cellWidth * 2));
        const xPosCount = xPosNum + cellWidth;

        doc.fillColor(lightGray).rect(xPosNum, yPos, cellWidth, rowHeight).fill().stroke();
        doc.fillColor(lightGray).rect(xPosCount, yPos, cellWidth, rowHeight).fill().stroke();
        
        doc.fillColor('black').font('Helvetica-Bold').fontSize(10).text(columnTotals[j], xPosCount + padding, yPos + padding);
    }
    
    yPos += 25;
    const grandTotalWidth = 100;
    const grandTotalX = (doc.page.width - grandTotalWidth) / 2;
    doc.rect(grandTotalX, yPos, grandTotalWidth, rowHeight).stroke();
    doc.font('Helvetica-Bold').fontSize(10).text(`GRAN TOTAL: ${grandTotal}`, grandTotalX + padding, yPos + padding);

    doc.end();
});

app.listen(port, () => {
    console.log(`Servidor de backend escuchando en http://localhost:${port}`);
});