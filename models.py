import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, CheckConstraint
from sqlalchemy.orm import relationship
from database import Base

class Turma(Base):
    __tablename__ = "turmas"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    ano = Column(String, nullable=False) # Ex: "3" para 3º ano
    curso = Column(String, nullable=False) # Ex: "Informática"

    # Relacionamentos
    alunos = relationship("Aluno", back_populates="turma", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "nome": self.nome,
            "ano": self.ano,
            "curso": self.curso
        }


class Aluno(Base):
    __tablename__ = "alunos"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    matricula = Column(String, unique=True, nullable=False, index=True) # "matrícula"
    foto = Column(String, nullable=True) # Nome do arquivo de foto ou URL
    turma_id = Column(Integer, ForeignKey("turmas.id", ondelete="CASCADE"), nullable=False)

    # Relacionamentos
    turma = relationship("Turma", back_populates="alunos")
    status_atividades = relationship("StatusAtividade", back_populates="aluno", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "nome": self.nome,
            "matricula": self.matricula,
            "foto": self.foto,
            "turma_id": self.turma_id
        }


class Exercicio(Base):
    __tablename__ = "exercicios"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, nullable=False) # "título"
    modulo = Column(String, nullable=False) # "módulo"
    descricao = Column(String, nullable=False) # "descrição" (mantido para compatibilidade, igual ao enunciado)
    nivel = Column(String, nullable=False) # "nível" (Fácil, Médio, Difícil)
    tempo_estimado = Column(Integer, nullable=False) # em minutos
    
    # Novos campos obrigatórios para programação Python
    objetivo_aprendizado = Column(String, nullable=False, default="")
    enunciado = Column(String, nullable=False, default="")
    entrada_esperada = Column(String, nullable=False, default="")
    saida_esperada = Column(String, nullable=False, default="")
    exemplo_entrada = Column(String, nullable=False, default="")
    exemplo_saida = Column(String, nullable=False, default="")
    
    # Campo opcional exclusivo do professor
    observacoes = Column(String, nullable=True)

    # Relacionamentos
    status_atividades = relationship("StatusAtividade", back_populates="exercicio", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "titulo": self.titulo,
            "modulo": self.modulo,
            "descricao": self.descricao,
            "nivel": self.nivel,
            "tempo_estimado": self.tempo_estimado,
            "objetivo_aprendizado": self.objetivo_aprendizado,
            "enunciado": self.enunciado,
            "entrada_esperada": self.entrada_esperada,
            "saida_esperada": self.saida_esperada,
            "exemplo_entrada": self.exemplo_entrada,
            "exemplo_saida": self.exemplo_saida,
            "observacoes": self.observacoes or ""
        }


class StatusAtividade(Base):
    __tablename__ = "status_atividades"

    id = Column(Integer, primary_key=True, index=True)
    aluno_id = Column(Integer, ForeignKey("alunos.id", ondelete="CASCADE"), nullable=False)
    exercicio_id = Column(Integer, ForeignKey("exercicios.id", ondelete="CASCADE"), nullable=False)
    estado_atual = Column(String, nullable=False) # "Não Iniciado", "Codificando", "Preciso de Ajuda", "Pausado", "Concluído"
    progresso = Column(Integer, nullable=False) # Inteiro entre 0 e 100
    tempo_inicio = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    tempo_fim = Column(DateTime, nullable=True)
    observacao = Column(String, nullable=True) # "observação"

    # Relacionamentos
    aluno = relationship("Aluno", back_populates="status_atividades")
    exercicio = relationship("Exercicio", back_populates="status_atividades")

    # Restrições de Verificação (Check Constraints) no banco de dados
    __table_args__ = (
        CheckConstraint(
            "estado_atual IN ('Não Iniciado', 'Codificando', 'Preciso de Ajuda', 'Pausado', 'Concluído')",
            name="check_estado_atual"
        ),
        CheckConstraint(
            "progresso >= 0 AND progresso <= 100",
            name="check_progresso"
        ),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "aluno_id": self.aluno_id,
            "exercicio_id": self.exercicio_id,
            "estado_atual": self.estado_atual,
            "progresso": self.progresso,
            "tempo_inicio": self.tempo_inicio.isoformat() if self.tempo_inicio else None,
            "tempo_fim": self.tempo_fim.isoformat() if self.tempo_fim else None,
            "observacao": self.observacao
        }


class Professor(Base):
    __tablename__ = "professores"

    id = Column(Integer, primary_key=True, index=True)
    usuario = Column(String, unique=True, nullable=False, index=True)
    senha_hash = Column(String, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "usuario": self.usuario
        }


class HistoricoStatus(Base):
    __tablename__ = "historico_status"

    id = Column(Integer, primary_key=True, index=True)
    aluno_id = Column(Integer, ForeignKey("alunos.id", ondelete="CASCADE"), nullable=False)
    exercicio_id = Column(Integer, ForeignKey("exercicios.id", ondelete="CASCADE"), nullable=False)
    estado_anterior = Column(String, nullable=True)
    estado_novo = Column(String, nullable=False)
    progresso = Column(Integer, nullable=False)
    tempo_decorrido = Column(Integer, nullable=True) # em segundos
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    observacao = Column(String, nullable=True)

    # Relacionamentos
    aluno = relationship("Aluno")
    exercicio = relationship("Exercicio")

    def to_dict(self):
        return {
            "id": self.id,
            "aluno_id": self.aluno_id,
            "exercicio_id": self.exercicio_id,
            "estado_anterior": self.estado_anterior,
            "estado_novo": self.estado_novo,
            "progresso": self.progresso,
            "tempo_decorrido": self.tempo_decorrido,
            "timestamp": self.timestamp.isoformat() + "Z" if self.timestamp else None,
            "observacao": self.observacao
        }
