declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf';

  interface UserOptions {
    startY?: number;
    head?: (string | number)[][];
    body?: (string | number)[][];
    foot?: (string | number)[][];
    theme?: string;
    headStyles?: Record<string, unknown>;
  }

  export default function autoTable(doc: jsPDF, options: UserOptions): void;
}
