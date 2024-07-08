import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SalesService } from 'src/app/services/sales.service';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-confirm-sale',
  templateUrl: './confirm-sale.component.html',
  styleUrls: ['./confirm-sale.component.css']
})
export class ConfirmSaleComponent implements OnInit {
  confirmSaleForm!: FormGroup;
  sale: any;
  totalAmount: number;
  change: number = 0;
  usuario = this.authService.usuario.name;

  constructor(
    private fb: FormBuilder,
    private saleService: SalesService,
    private router: Router,
    private authService: AuthService
  ) {
    const navigation = this.router.getCurrentNavigation();
    this.sale = navigation?.extras.state?.['sale'];
    this.totalAmount = this.sale.total - this.sale.discount;
    this.sale.productsSold = this.sale.productsSold.map((product: any) => ({
      ...product,
      productName: product.name || 'Nombre del producto'
    }));
    console.log(this.sale);
  }

  ngOnInit(): void {
    this.confirmSaleForm = this.fb.group({
      paymentMethod: ['', Validators.required],
      paymentReference: [''],
      receivedAmount: [0, Validators.required],
      change: [{ value: 0, disabled: true }]
    });

    this.confirmSaleForm.get('paymentMethod')!.valueChanges.subscribe((value) => {

      if (value === 'card') {
        this.confirmSaleForm.get('paymentReference')!.setValidators([Validators.required]);
      } else {
        this.confirmSaleForm.get('paymentReference')!.clearValidators();
      }
      this.confirmSaleForm.get('paymentReference')!.updateValueAndValidity();
      this.confirmSaleForm.get('receivedAmount')!.updateValueAndValidity();
    });

    this.confirmSaleForm.get('receivedAmount')!.valueChanges.subscribe((value) => {
      this.change = value - this.totalAmount;
      this.confirmSaleForm.patchValue({ change: this.change });
    });
  }

  confirmSale(): void {
    if (this.confirmSaleForm.invalid) {
      return;
    }

    const saleData = {
      ...this.sale,
      paymentMethod: this.confirmSaleForm.value.paymentMethod,
      paymentReference: this.confirmSaleForm.value.paymentReference,
      receivedAmount: this.confirmSaleForm.value.receivedAmount,
      change: this.change
    };

    this.saleService.createSale(saleData).subscribe(response => {
      console.log('Sale created successfully', response);
      this.generarPDF();
      this.router.navigate(['dashboard/user/sales-success']);
    }, error => {
      console.error('Error creating sale', error);
    });
  }

  generarPDF() {
    const doc = new jsPDF({
      format: [58.28, 350.89]
    });

    const marginX = 2;
    let currentY = 10;

    doc.setFontSize(10);
    doc.text('Ticket de Venta', marginX, currentY);
    currentY += 4;

    doc.setFontSize(8);
    doc.text(`Usuario: ${this.usuario}`, marginX, currentY);
    currentY += 4;
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, marginX, currentY);
    currentY += 4;
    doc.text(`Total: $${this.totalAmount.toFixed(2)}`, marginX, currentY);
    currentY += 4;
    doc.text(`Pago con: $${this.confirmSaleForm.get('receivedAmount')!.value.toFixed(2)}`, marginX, currentY);
    currentY += 6;
    doc.text(`Cambio: $${this.change.toFixed(2)}`, marginX, currentY);
    currentY += 6;

    (doc as any).autoTable({
      head: [['Producto', 'Cantidad', 'Precio']],
      body: this.sale.productsSold.map((product: any) => [
        product.productName,
        product.quantity,
        product.subtotal
      ]),
      startY: currentY,
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 7, cellPadding: 1, overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 15 }, 2: { cellWidth: 15 } },
      theme: 'plain'
    });

    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const printWindow = window.open(url)!;

    printWindow.onload = () => {
      printWindow.print();
      printWindow.onafterprint = () => {
        printWindow.close();
      };
    };
  }
}
