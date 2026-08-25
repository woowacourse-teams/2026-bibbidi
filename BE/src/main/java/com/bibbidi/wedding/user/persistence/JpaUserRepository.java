package com.bibbidi.wedding.user.persistence;

import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.exception.DuplicateNicknameException;
import com.bibbidi.wedding.user.repository.UserRepository;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;

@Repository
public class JpaUserRepository implements UserRepository {

    private static final Set<String> NICKNAME_UNIQUE_CONSTRAINTS = Set.of(
            "uk_users_nickname",
            "nickname"
    );

    private final UserDao userDao;
    private final UserMapper userMapper;

    public JpaUserRepository(UserDao userDao, UserMapper userMapper) {
        this.userDao = userDao;
        this.userMapper = userMapper;
    }

    @Override
    public boolean existsByNickname(String nickname) {
        return userDao.existsByNicknameIgnoreCase(nickname);
    }

    @Override
    public User save(User user) {
        try {
            UserEntity saved = userDao.saveAndFlush(userMapper.toEntity(user));
            return userMapper.toDomain(saved);
        } catch (DataIntegrityViolationException exception) {
            if (isNicknameUniqueViolation(exception)) {
                throw new DuplicateNicknameException();
            }
            throw exception;
        }
    }

    @Override
    public Optional<User> findByNickname(String nickname) {
        return userDao.findByNicknameIgnoreCase(nickname).map(userMapper::toDomain);
    }

    private boolean isNicknameUniqueViolation(DataIntegrityViolationException exception) {
        Throwable cause = exception;

        while (cause != null) {
            if (cause instanceof ConstraintViolationException constraintViolation) {
                return isNicknameConstraint(constraintViolation.getConstraintName());
            }
            cause = cause.getCause();
        }
        return false;
    }

    private boolean isNicknameConstraint(String constraintName) {
        if (constraintName == null) {
            return false;
        }

        String normalizedName = constraintName
                .replace("`", "")
                .replace("\"", "")
                .toLowerCase(Locale.ROOT)
                .trim();
        String qualifiedName = normalizedName.split("\\s+", 2)[0];
        int separatorIndex = qualifiedName.lastIndexOf('.');
        String unqualifiedName = qualifiedName.substring(separatorIndex + 1);
        return NICKNAME_UNIQUE_CONSTRAINTS.contains(unqualifiedName);
    }
}
