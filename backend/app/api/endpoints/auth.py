import uuid
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
import jwt

from app.db.session import get_db
from app.models.user import User
from app.models.tenant import Tenant
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from fastapi.security import OAuth2PasswordBearer

router = APIRouter()
from fastapi import Request, Query
from typing import Optional

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login", auto_error=False)

class UserCreate(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

@router.post("/register", response_model=Token)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )
        
    # For a new registration, we create a new tenant
    tenant_id = str(uuid.uuid4())
    tenant = Tenant(id=tenant_id, name=user_in.name)
    db.add(tenant)
    db.commit()
    
    user_id = str(uuid.uuid4())
    user = User(
        id=user_id,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        tenant_id=tenant_id
    )
    db.add(user)
    db.commit()
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id, tenant_id=user.tenant_id, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_in.email).first()
    if not user or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id, tenant_id=user.tenant_id, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

def get_current_tenant_id(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    token_query: Optional[str] = Query(None, alias="token")
) -> str:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    raw_token = token or token_query or request.cookies.get("auth_token")
    if not raw_token:
        raise credentials_exception
    try:
        payload = jwt.decode(raw_token, settings.SECRET_KEY, algorithms=["HS256"])
        tenant_id: str = payload.get("tenant_id")
        if tenant_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    return tenant_id


@router.get("/me")
def get_current_user_info(
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db)
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    user = db.query(User).filter(User.tenant_id == tenant_id).first()
        
    return {
        "tenant_id": tenant.id,
        "name": tenant.name,
        "token_quota": tenant.token_quota,
        "tokens_used": tenant.tokens_used,
        "email": user.email if user else None
    }
