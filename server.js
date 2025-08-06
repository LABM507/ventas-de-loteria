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
    
    const doc = new PDFDocument({ 
        size: [226.77, 1000],
        margins: 15,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=factura_${ventaData.cliente}.pdf`);
    doc.pipe(res);

    let yPos = 15;
    const leftMargin = 15;
    const rightMargin = 20;

    doc.font('Helvetica-Bold').fontSize(10).text('COMPROBANTE DE VENTA', leftMargin, yPos, { align: 'center', width: 226.77 - leftMargin - rightMargin });
    yPos += 15;
    doc.font('Helvetica').fontSize(8).text(`Fecha: ${ventaData.fecha}`, leftMargin, yPos, { align: 'center', width: 226.77 - leftMargin - rightMargin });
    yPos += 12;
    doc.text(`Cliente: ${ventaData.cliente}`, leftMargin, yPos, { align: 'center', width: 226.77 - leftMargin - rightMargin });
    yPos += 20;

    doc.font('Helvetica-Bold').fontSize(8).text('Detalle de la Compra', leftMargin, yPos);
    yPos += 15;

    const headerY = yPos;
    doc.font('Helvetica-Bold')
       .text('Número', leftMargin, headerY, { width: 50 })
       .text('Cantidad', leftMargin + 75, headerY, { width: 50 })
       .text('Subtotal', leftMargin + 130, headerY, { align: 'right', width: 60 });
    yPos += 12;
    doc.moveTo(10, yPos).lineTo(216.77, yPos).stroke();
    yPos += 5;

    doc.font('Helvetica');
    ventaData.billetes.forEach(billete => {
        // Lógica de paginación
        if (yPos + 20 > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
            yPos = doc.y; // Reinicia la posición y con el margen de la nueva página
        }
        
        doc.text(String(billete.numero).padStart(2, '0'), leftMargin, yPos);
        doc.text(billete.cantidad.toString(), leftMargin + 75, yPos);
        doc.text(`$${(billete.cantidad * 0.25).toFixed(2)}`, leftMargin + 130, yPos, { align: 'right', width: 60 });
        yPos += 12;
    });

    yPos += 15;
    
    doc.font('Helvetica-Bold').fontSize(8)
       .text(`Total de Billetes: ${ventaData.totalBilletes}`, leftMargin, yPos);
    yPos += 12;
    doc.text(`Total a Pagar: $${ventaData.totalPagar.toFixed(2)}`, leftMargin, yPos);
    yPos += 30;

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