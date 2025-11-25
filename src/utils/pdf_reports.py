from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib import colors
from datetime import datetime
import os

class PDFReportGenerator:
    def __init__(self):
        self.reports_dir = 'reports'
        os.makedirs(self.reports_dir, exist_ok=True)
        self.styles = getSampleStyleSheet()
        
        self.title_style = ParagraphStyle(
            'CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1a1a1a'),
            spaceAfter=30,
            alignment=TA_CENTER
        )
        
        self.heading_style = ParagraphStyle(
            'CustomHeading',
            parent=self.styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#333333'),
            spaceAfter=12,
            spaceBefore=12
        )
    
    def generate_location_report(self, user_data, locations, start_date, end_date):
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"location_report_{user_data['id']}_{timestamp}.pdf"
        filepath = os.path.join(self.reports_dir, filename)
        
        doc = SimpleDocTemplate(filepath, pagesize=A4)
        story = []
        
        story.append(Paragraph('Family Guardian 360°', self.title_style))
        story.append(Paragraph('Relatório de Localização', self.heading_style))
        story.append(Spacer(1, 0.2*inch))
        
        info_data = [
            ['Usuário:', user_data.get('full_name', 'N/A')],
            ['Email:', user_data.get('email', 'N/A')],
            ['Período:', f"{start_date} a {end_date}"],
            ['Total de registros:', str(len(locations))],
            ['Data do relatório:', datetime.now().strftime('%d/%m/%Y %H:%M')]
        ]
        
        info_table = Table(info_data, colWidths=[2*inch, 4*inch])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f0f0')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey)
        ]))
        story.append(info_table)
        story.append(Spacer(1, 0.3*inch))
        
        story.append(Paragraph('Histórico de Localizações', self.heading_style))
        
        location_data = [['Data/Hora', 'Latitude', 'Longitude', 'Bateria']]
        for loc in locations[:100]:
            try:
                dt = datetime.fromisoformat(loc['timestamp'].replace('Z', '+00:00'))
                date_str = dt.strftime('%d/%m/%Y %H:%M')
            except:
                date_str = loc.get('timestamp', 'N/A')
            
            try:
                lat = float(loc.get('latitude', 0))
                lat_str = f"{lat:.6f}"
            except (ValueError, TypeError):
                lat_str = 'N/A'
            
            try:
                lon = float(loc.get('longitude', 0))
                lon_str = f"{lon:.6f}"
            except (ValueError, TypeError):
                lon_str = 'N/A'
            
            try:
                battery = int(loc.get('battery_level', 0))
                battery_str = f"{battery}%"
            except (ValueError, TypeError):
                battery_str = 'N/A'
            
            location_data.append([
                date_str,
                lat_str,
                lon_str,
                battery_str
            ])
        
        location_table = Table(location_data, colWidths=[1.8*inch, 1.5*inch, 1.5*inch, 1*inch])
        location_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4a90e2')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(location_table)
        
        story.append(Spacer(1, 0.3*inch))
        story.append(Paragraph(
            f'Relatório gerado automaticamente em {datetime.now().strftime("%d/%m/%Y às %H:%M")}',
            self.styles['Normal']
        ))
        
        doc.build(story)
        return filepath
    
    def generate_activity_report(self, user_data, stats, period='monthly'):
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"activity_report_{user_data['id']}_{timestamp}.pdf"
        filepath = os.path.join(self.reports_dir, filename)
        
        doc = SimpleDocTemplate(filepath, pagesize=A4)
        story = []
        
        story.append(Paragraph('Family Guardian 360°', self.title_style))
        story.append(Paragraph('Relatório de Atividades', self.heading_style))
        story.append(Spacer(1, 0.2*inch))
        
        info_data = [
            ['Usuário:', user_data.get('full_name', 'N/A')],
            ['Período:', period.capitalize()],
            ['Data do relatório:', datetime.now().strftime('%d/%m/%Y %H:%M')]
        ]
        
        info_table = Table(info_data, colWidths=[2*inch, 4*inch])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f0f0')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey)
        ]))
        story.append(info_table)
        story.append(Spacer(1, 0.3*inch))
        
        story.append(Paragraph('Estatísticas', self.heading_style))
        
        stats_data = [
            ['Métrica', 'Valor'],
            ['Localizações registradas', str(stats.get('total_locations', 0))],
            ['Alertas gerados', str(stats.get('total_alerts', 0))],
            ['Mensagens enviadas', str(stats.get('total_messages', 0))],
            ['Nível médio de bateria', f"{stats.get('avg_battery', 0):.1f}%"],
            ['Zonas seguras ativas', str(stats.get('safe_zones', 0))]
        ]
        
        stats_table = Table(stats_data, colWidths=[3*inch, 2*inch])
        stats_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4a90e2')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(stats_table)
        
        story.append(Spacer(1, 0.3*inch))
        story.append(Paragraph(
            f'Relatório gerado automaticamente em {datetime.now().strftime("%d/%m/%Y às %H:%M")}',
            self.styles['Normal']
        ))
        
        doc.build(story)
        return filepath
    
    def generate_family_report(self, family_data, members, period='monthly'):
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"family_report_{family_data['id']}_{timestamp}.pdf"
        filepath = os.path.join(self.reports_dir, filename)
        
        doc = SimpleDocTemplate(filepath, pagesize=A4)
        story = []
        
        story.append(Paragraph('Family Guardian 360°', self.title_style))
        story.append(Paragraph('Relatório Familiar', self.heading_style))
        story.append(Spacer(1, 0.2*inch))
        
        info_data = [
            ['Família:', family_data.get('name', 'N/A')],
            ['Total de membros:', str(len(members))],
            ['Período:', period.capitalize()],
            ['Data do relatório:', datetime.now().strftime('%d/%m/%Y %H:%M')]
        ]
        
        info_table = Table(info_data, colWidths=[2*inch, 4*inch])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f0f0')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey)
        ]))
        story.append(info_table)
        story.append(Spacer(1, 0.3*inch))
        
        story.append(Paragraph('Membros da Família', self.heading_style))
        
        members_data = [['Nome', 'Email', 'Função', 'Status']]
        for member in members:
            members_data.append([
                member.get('full_name', 'N/A'),
                member.get('email', 'N/A'),
                member.get('role', 'member'),
                'Ativo' if member.get('is_active') else 'Inativo'
            ])
        
        members_table = Table(members_data, colWidths=[2*inch, 2.5*inch, 1*inch, 1*inch])
        members_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4a90e2')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(members_table)
        
        story.append(Spacer(1, 0.3*inch))
        story.append(Paragraph(
            f'Relatório gerado automaticamente em {datetime.now().strftime("%d/%m/%Y às %H:%M")}',
            self.styles['Normal']
        ))
        
        doc.build(story)
        return filepath

pdf_generator = PDFReportGenerator()
